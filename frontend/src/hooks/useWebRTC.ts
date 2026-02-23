import { useState, useEffect, useRef, useCallback } from 'react'
import type { Message } from '../types/models'

// --- ICE Server Configuration ---
// STUN servers for NAT traversal. Add TURN servers here for strict NAT/firewall environments.
const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TODO: Add TURN server for production
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'turnuser',
    //   credential: 'turnpassword',
    // },
]

export interface RemoteStream {
    username: string
    stream: MediaStream
}

interface UseWebRTCOptions {
    /** All WebSocket messages */
    messages: Message[]
    /** Send function for signaling */
    sendDirect: (type: Message['type'], payload: string) => void
    /** Current username */
    username: string
    /** Is WebSocket connected */
    isConnected: boolean
}

/**
 * useWebRTC — manages WebRTC peer connections for voice/video/screenshare.
 *
 * Lifecycle:
 *   joinCall() → getUserMedia → create offers to all connected users
 *   leaveCall() → stop ALL tracks → close ALL RTCPeerConnections → cleanup
 *
 * CLEANUP CONTRACT:
 *   - Every track added to localStream is explicitly stopped on leave
 *   - Every RTCPeerConnection is explicitly closed on leave
 *   - Component unmount triggers full cleanup via useEffect return
 *   - This ensures the camera/mic indicator light turns off
 */
export function useWebRTC({ messages, sendDirect, username, isConnected: _isConnected }: UseWebRTCOptions) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
    const [isInCall, setIsInCall] = useState(false)
    const [isMicOn, setIsMicOn] = useState(true)
    const [isCameraOn, setIsCameraOn] = useState(true)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [connectedUsers, setConnectedUsers] = useState<string[]>([])

    // Refs for stable access in callbacks
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
    const localStreamRef = useRef<MediaStream | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)
    const isInCallRef = useRef(false)
    const usernameRef = useRef(username)

    usernameRef.current = username

    // ─── Signaling: send WebRTC message to a specific user ───
    const sendSignal = useCallback((event: string, target: string, data: Record<string, unknown>) => {
        sendDirect('webrtc', JSON.stringify({
            event,
            target,
            sender: usernameRef.current,
            ...data,
        }))
    }, [sendDirect])

    // ─── Create a new RTCPeerConnection for a remote peer ───
    const createPeerConnection = useCallback((remoteUsername: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

        // Send ICE candidates to the remote peer
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal('ice-candidate', remoteUsername, {
                    candidate: event.candidate.toJSON(),
                })
            }
        }

        // Handle incoming remote tracks
        pc.ontrack = (event) => {
            const [stream] = event.streams
            if (!stream) return

            setRemoteStreams((prev) => {
                // Update existing stream or add new one
                const exists = prev.find((rs) => rs.username === remoteUsername)
                if (exists) {
                    return prev.map((rs) =>
                        rs.username === remoteUsername ? { ...rs, stream } : rs
                    )
                }
                return [...prev, { username: remoteUsername, stream }]
            })
        }

        // Log connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`[webrtc] ${remoteUsername}: ${pc.connectionState}`)
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                removePeer(remoteUsername)
            }
        }

        // Add local tracks to the connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!)
            })
        }

        peersRef.current.set(remoteUsername, pc)
        return pc
    }, [sendSignal])

    // ─── Remove a peer connection and clean up ───
    const removePeer = useCallback((remoteUsername: string) => {
        const pc = peersRef.current.get(remoteUsername)
        if (pc) {
            pc.close()
            peersRef.current.delete(remoteUsername)
        }
        setRemoteStreams((prev) => prev.filter((rs) => rs.username !== remoteUsername))
    }, [])

    // ─── FULL CLEANUP — stops all media, closes all peers ───
    const fullCleanup = useCallback(() => {
        console.log('[webrtc] full cleanup — stopping all tracks and closing all peers')

        // 1. Stop every track in the local stream (camera + mic)
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                track.stop()
                console.log(`[webrtc] stopped local track: ${track.kind}`)
            })
            localStreamRef.current = null
        }

        // 2. Stop every track in the screen share stream
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => {
                track.stop()
                console.log(`[webrtc] stopped screen track: ${track.kind}`)
            })
            screenStreamRef.current = null
        }

        // 3. Close every RTCPeerConnection
        peersRef.current.forEach((pc, peerUsername) => {
            pc.close()
            console.log(`[webrtc] closed peer connection: ${peerUsername}`)
        })
        peersRef.current.clear()

        // 4. Reset all state
        setLocalStream(null)
        setRemoteStreams([])
        setIsInCall(false)
        setIsMicOn(true)
        setIsCameraOn(true)
        setIsScreenSharing(false)
        isInCallRef.current = false
    }, [])

    // ─── Join Call ───
    const joinCall = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            })

            localStreamRef.current = stream
            setLocalStream(stream)
            setIsInCall(true)
            isInCallRef.current = true

            // Create offers to all connected users (except ourselves)
            const otherUsers = connectedUsers.filter((u) => u !== username)
            for (const remoteUser of otherUsers) {
                const pc = createPeerConnection(remoteUser)
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                sendSignal('offer', remoteUser, { sdp: pc.localDescription?.toJSON() })
            }

            console.log(`[webrtc] joined call, offering to ${otherUsers.length} peers`)
        } catch (err) {
            console.error('[webrtc] failed to get media:', err)
            fullCleanup()
        }
    }, [connectedUsers, username, createPeerConnection, sendSignal, fullCleanup])

    // ─── Leave Call ───
    const leaveCall = useCallback(() => {
        fullCleanup()
    }, [fullCleanup])

    // ─── Toggle Mic ───
    const toggleMic = useCallback(() => {
        if (!localStreamRef.current) return
        const audioTrack = localStreamRef.current.getAudioTracks()[0]
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled
            setIsMicOn(audioTrack.enabled)
        }
    }, [])

    // ─── Toggle Camera ───
    const toggleCamera = useCallback(() => {
        if (!localStreamRef.current) return
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled
            setIsCameraOn(videoTrack.enabled)
        }
    }, [])

    // ─── Toggle Screen Share ───
    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            // Stop screen share — revert to camera
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((track) => track.stop())
                screenStreamRef.current = null
            }

            // Replace screen track with camera track in all peer connections
            if (localStreamRef.current) {
                const cameraTrack = localStreamRef.current.getVideoTracks()[0]
                if (cameraTrack) {
                    peersRef.current.forEach((pc) => {
                        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
                        if (sender) sender.replaceTrack(cameraTrack)
                    })
                }
            }
            setIsScreenSharing(false)
        } else {
            // Start screen share
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false,
                })
                screenStreamRef.current = screenStream

                const screenTrack = screenStream.getVideoTracks()[0]

                // Handle user clicking "Stop sharing" in browser UI
                screenTrack.onended = () => {
                    toggleScreenShare() // Recursively revert to camera
                }

                // Replace camera track with screen track in all peer connections
                peersRef.current.forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
                    if (sender) sender.replaceTrack(screenTrack)
                })

                setIsScreenSharing(true)
            } catch (err) {
                console.error('[webrtc] failed to get screen share:', err)
            }
        }
    }, [isScreenSharing])

    // ─── Handle incoming WebRTC signaling messages ───
    useEffect(() => {
        if (!isInCallRef.current || messages.length === 0) return

        const lastMsg = messages[messages.length - 1]
        if (lastMsg.type !== 'webrtc') return

        const handleSignal = async () => {
            try {
                const data = JSON.parse(lastMsg.payload)
                if (data.target !== username) return // Not for us

                switch (data.event) {
                    case 'offer': {
                        console.log(`[webrtc] received offer from ${data.sender}`)
                        const pc = createPeerConnection(data.sender)
                        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
                        const answer = await pc.createAnswer()
                        await pc.setLocalDescription(answer)
                        sendSignal('answer', data.sender, { sdp: pc.localDescription?.toJSON() })
                        break
                    }

                    case 'answer': {
                        console.log(`[webrtc] received answer from ${data.sender}`)
                        const pc = peersRef.current.get(data.sender)
                        if (pc) {
                            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
                        }
                        break
                    }

                    case 'ice-candidate': {
                        const pc = peersRef.current.get(data.sender)
                        if (pc && data.candidate) {
                            await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
                        }
                        break
                    }
                }
            } catch (err) {
                console.error('[webrtc] signaling error:', err)
            }
        }

        handleSignal()
    }, [messages, username, createPeerConnection, sendSignal])

    // ─── Track connected users from user_list messages ───
    useEffect(() => {
        if (messages.length === 0) return
        const lastMsg = messages[messages.length - 1]
        if (lastMsg.type !== 'user_list') return

        try {
            const users = JSON.parse(lastMsg.payload) as string[]
            setConnectedUsers(users)

            // Remove peers that are no longer connected
            peersRef.current.forEach((_, peerUsername) => {
                if (!users.includes(peerUsername)) {
                    removePeer(peerUsername)
                }
            })
        } catch (err) {
            console.error('[webrtc] failed to parse user list:', err)
        }
    }, [messages, removePeer])

    // ─── CRITICAL: cleanup on unmount (tab close, navigation, etc.) ───
    useEffect(() => {
        // Also handle the browser's beforeunload event
        const handleBeforeUnload = () => {
            fullCleanup()
        }
        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            fullCleanup()
        }
    }, [fullCleanup])

    return {
        localStream,
        remoteStreams,
        isInCall,
        isMicOn,
        isCameraOn,
        isScreenSharing,
        connectedUsers,
        joinCall,
        leaveCall,
        toggleMic,
        toggleCamera,
        toggleScreenShare,
    }
}
