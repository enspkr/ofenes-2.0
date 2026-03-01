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
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([])
    const [remoteScreenAudioStreams, setRemoteScreenAudioStreams] = useState<RemoteStream[]>([])
    const [isInCall, setIsInCall] = useState(false)
    const [isMicOn, setIsMicOn] = useState(true)
    const [isCameraOn, setIsCameraOn] = useState(true)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [connectedUsers, setConnectedUsers] = useState<string[]>([])

    // Refs for stable access in callbacks
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
    const localStreamRef = useRef<MediaStream | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)
    const screenAudioSendersRef = useRef<Map<string, RTCRtpSender>>(new Map())
    const remoteStreamIdsRef = useRef<Map<string, string>>(new Map()) // username -> primary stream id
    const isInCallRef = useRef(false)
    const usernameRef = useRef(username)
    const processedIndexRef = useRef(0)

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

    // ─── Remove a peer connection and clean up ───
    const removePeer = useCallback((remoteUsername: string) => {
        const pc = peersRef.current.get(remoteUsername)
        if (pc) {
            pc.close()
            peersRef.current.delete(remoteUsername)
        }
        remoteStreamIdsRef.current.delete(remoteUsername)
        setRemoteStreams((prev) => prev.filter((rs) => rs.username !== remoteUsername))
        setRemoteScreenAudioStreams((prev) => prev.filter((rs) => rs.username !== remoteUsername))
    }, [])

    // ─── Create a new RTCPeerConnection for a remote peer ───
    const createPeerConnection = useCallback((remoteUsername: string): RTCPeerConnection => {
        // Close existing peer if one exists (prevents duplicate connections)
        const existing = peersRef.current.get(remoteUsername)
        if (existing) {
            existing.close()
            peersRef.current.delete(remoteUsername)
        }

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

            const knownStreamId = remoteStreamIdsRef.current.get(remoteUsername)

            if (!knownStreamId) {
                // First stream from this user — this is their camera/mic stream
                remoteStreamIdsRef.current.set(remoteUsername, stream.id)
                setRemoteStreams((prev) => {
                    const exists = prev.find((rs) => rs.username === remoteUsername)
                    if (exists) {
                        return prev.map((rs) =>
                            rs.username === remoteUsername ? { ...rs, stream } : rs
                        )
                    }
                    return [...prev, { username: remoteUsername, stream }]
                })
            } else if (stream.id === knownStreamId) {
                // Same primary stream — update it
                setRemoteStreams((prev) =>
                    prev.map((rs) =>
                        rs.username === remoteUsername ? { ...rs, stream } : rs
                    )
                )
            } else {
                // Different stream — this is screen share audio
                console.log(`[webrtc] received screen audio stream from ${remoteUsername}`)
                setRemoteScreenAudioStreams((prev) => {
                    const exists = prev.find((rs) => rs.username === remoteUsername)
                    if (exists) {
                        return prev.map((rs) =>
                            rs.username === remoteUsername ? { ...rs, stream } : rs
                        )
                    }
                    return [...prev, { username: remoteUsername, stream }]
                })

                // Clean up screen audio stream when its track ends
                stream.getAudioTracks().forEach((track) => {
                    track.onended = () => {
                        setRemoteScreenAudioStreams((prev) =>
                            prev.filter((rs) => rs.username !== remoteUsername)
                        )
                    }
                })
            }
        }

        // Handle renegotiation (triggered by addTrack/removeTrack for screen audio)
        pc.onnegotiationneeded = async () => {
            try {
                console.log(`[webrtc] renegotiation needed with ${remoteUsername}`)
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                sendSignal('offer', remoteUsername, { sdp: pc.localDescription?.toJSON() })
            } catch (err) {
                console.error(`[webrtc] renegotiation failed for ${remoteUsername}:`, err)
            }
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

        // If screen sharing is active, replace video track and add screen audio
        if (screenStreamRef.current) {
            const screenVideoTrack = screenStreamRef.current.getVideoTracks()[0]
            const screenAudioTrack = screenStreamRef.current.getAudioTracks()[0]

            if (screenVideoTrack) {
                const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video')
                if (videoSender) videoSender.replaceTrack(screenVideoTrack)
            }

            if (screenAudioTrack) {
                const audioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current)
                screenAudioSendersRef.current.set(remoteUsername, audioSender)
            }
        }

        peersRef.current.set(remoteUsername, pc)
        return pc
    }, [sendSignal, removePeer])

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
        setScreenStream(null)

        // 3. Close every RTCPeerConnection
        peersRef.current.forEach((pc, peerUsername) => {
            pc.close()
            console.log(`[webrtc] closed peer connection: ${peerUsername}`)
        })
        peersRef.current.clear()

        // 4. Clear screen audio senders and stream ID tracking
        screenAudioSendersRef.current.clear()
        remoteStreamIdsRef.current.clear()

        // 5. Reset all state
        setLocalStream(null)
        setScreenStream(null)
        setRemoteStreams([])
        setRemoteScreenAudioStreams([])
        setIsInCall(false)
        setIsMicOn(true)
        setIsCameraOn(true)
        setIsScreenSharing(false)
        isInCallRef.current = false
    }, [])

    // ─── Acquire local media (used by joinCall and auto-join) ───
    const acquireMedia = useCallback(async (): Promise<MediaStream | null> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            })
            localStreamRef.current = stream
            setLocalStream(stream)
            setIsInCall(true)
            isInCallRef.current = true
            return stream
        } catch (err) {
            console.error('[webrtc] failed to get media:', err)
            fullCleanup()
            return null
        }
    }, [fullCleanup])

    // ─── Join Call ───
    const joinCall = useCallback(async () => {
        const stream = await acquireMedia()
        if (!stream) return

        // Create offers to connected users we don't already have a peer for
        const otherUsers = connectedUsers.filter(
            (u) => u !== username && !peersRef.current.has(u)
        )
        for (const remoteUser of otherUsers) {
            const pc = createPeerConnection(remoteUser)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            sendSignal('offer', remoteUser, { sdp: pc.localDescription?.toJSON() })
        }

        console.log(`[webrtc] joined call, offering to ${otherUsers.length} peers`)
    }, [connectedUsers, username, createPeerConnection, sendSignal, acquireMedia])

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
    const toggleScreenShare = useCallback(async (height?: number) => {
        if (isScreenSharing) {
            // Stop screen share — revert to camera

            // Remove screen audio senders from all peer connections
            screenAudioSendersRef.current.forEach((sender, peerUsername) => {
                const pc = peersRef.current.get(peerUsername)
                if (pc) {
                    try { pc.removeTrack(sender) } catch { /* already removed */ }
                }
            })
            screenAudioSendersRef.current.clear()

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
            setScreenStream(null)
        } else {
            // Start screen share
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: height ? { height: { ideal: height } } : true,
                    audio: true,
                })
                screenStreamRef.current = screenStream

                const screenTrack = screenStream.getVideoTracks()[0]
                const screenAudioTrack = screenStream.getAudioTracks()[0]

                // Handle user clicking "Stop sharing" in browser UI
                screenTrack.onended = () => {
                    toggleScreenShare() // Recursively revert to camera
                }

                // Replace camera track with screen track in all peer connections
                // and add screen audio track if available
                peersRef.current.forEach((pc, peerUsername) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
                    if (sender) sender.replaceTrack(screenTrack)

                    if (screenAudioTrack) {
                        const audioSender = pc.addTrack(screenAudioTrack, screenStream)
                        screenAudioSendersRef.current.set(peerUsername, audioSender)
                    }
                })

                setIsScreenSharing(true)
                setScreenStream(screenStream)
            } catch (err) {
                console.error('[webrtc] failed to get screen share:', err)
            }
        }
    }, [isScreenSharing])

    // ─── Process all new messages (unified handler) ───
    // Uses a processed index ref to ensure every message is handled exactly once,
    // even when the backend batches multiple messages in a single WebSocket frame.
    useEffect(() => {
        if (messages.length <= processedIndexRef.current) return

        const newMessages = messages.slice(processedIndexRef.current)
        processedIndexRef.current = messages.length

        const handleMessages = async () => {
            for (const msg of newMessages) {
                try {
                    if (msg.type === 'user_list') {
                        const users = JSON.parse(msg.payload) as string[]
                        setConnectedUsers(users)

                        // Remove peers that are no longer connected
                        peersRef.current.forEach((_, peerUsername) => {
                            if (!users.includes(peerUsername)) {
                                removePeer(peerUsername)
                            }
                        })
                    } else if (msg.type === 'webrtc') {
                        const data = JSON.parse(msg.payload)
                        if (data.target !== usernameRef.current) continue

                        switch (data.event) {
                            case 'offer': {
                                // Auto-join: if not in a call, acquire media first
                                if (!isInCallRef.current) {
                                    console.log(`[webrtc] auto-joining call (offer from ${data.sender})`)
                                    const stream = await navigator.mediaDevices.getUserMedia({
                                        audio: true,
                                        video: true,
                                    })
                                    localStreamRef.current = stream
                                    setLocalStream(stream)
                                    setIsInCall(true)
                                    isInCallRef.current = true
                                }

                                console.log(`[webrtc] received offer from ${data.sender}`)
                                // Reuse existing peer connection for renegotiation,
                                // only create a new one for the first offer
                                let pc = peersRef.current.get(data.sender)
                                if (!pc) {
                                    pc = createPeerConnection(data.sender)
                                }
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
                    }
                } catch (err) {
                    console.error('[webrtc] message processing error:', err)
                }
            }
        }

        handleMessages()
    }, [messages, createPeerConnection, sendSignal, removePeer])

    // ─── CRITICAL: cleanup on unmount (tab close, navigation, etc.) ───
    useEffect(() => {
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
        screenStream,
        remoteStreams,
        remoteScreenAudioStreams,
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
