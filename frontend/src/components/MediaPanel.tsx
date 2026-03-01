import { useState, useRef, useEffect, useCallback } from 'react'
import type { RemoteStream } from '../hooks/useWebRTC'
import { VideoTile } from './VideoTile'

interface MediaPanelProps {
    localStream: MediaStream | null
    screenStream: MediaStream | null
    remoteStreams: RemoteStream[]
    remoteScreenAudioStreams: RemoteStream[]
    isInCall: boolean
    isMicOn: boolean
    isCameraOn: boolean
    isScreenSharing: boolean
    connectedUsers: string[]
    currentUsername: string
    isConnected: boolean
    chatOpen: boolean
    onJoinCall: () => void
    onLeaveCall: () => void
    onToggleMic: () => void
    onToggleCamera: () => void
    onToggleScreenShare: (height?: number) => void
    onToggleChat: () => void
}

/**
 * useRemoteAudio — routes a remote MediaStream through Web Audio API GainNode
 * for per-user volume control. Returns a cleanup function.
 */
function useRemoteAudio(
    remoteStreams: RemoteStream[],
    volumes: Map<string, number>,
    screenAudioStreams: RemoteStream[],
    screenAudioVolumes: Map<string, number>,
) {
    const audioCtxRef = useRef<AudioContext | null>(null)
    const nodesRef = useRef<Map<string, { source: MediaStreamAudioSourceNode; gain: GainNode }>>(new Map())
    const screenNodesRef = useRef<Map<string, { source: MediaStreamAudioSourceNode; gain: GainNode }>>(new Map())

    // Initialize AudioContext lazily
    const getCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext()
        }
        return audioCtxRef.current
    }, [])

    // Mic audio routing
    useEffect(() => {
        const currentUsernames = new Set(remoteStreams.map((rs) => rs.username))

        nodesRef.current.forEach((nodes, username) => {
            if (!currentUsernames.has(username)) {
                nodes.source.disconnect()
                nodes.gain.disconnect()
                nodesRef.current.delete(username)
            }
        })

        for (const rs of remoteStreams) {
            const existing = nodesRef.current.get(rs.username)
            if (existing) {
                const vol = volumes.get(rs.username) ?? 1
                existing.gain.gain.value = vol
                continue
            }

            try {
                const ctx = getCtx()
                const source = ctx.createMediaStreamSource(rs.stream)
                const gain = ctx.createGain()
                gain.gain.value = volumes.get(rs.username) ?? 1
                source.connect(gain)
                gain.connect(ctx.destination)
                nodesRef.current.set(rs.username, { source, gain })
            } catch (err) {
                console.error(`[audio] failed to create audio nodes for ${rs.username}:`, err)
            }
        }
    }, [remoteStreams, volumes, getCtx])

    // Screen share audio routing
    useEffect(() => {
        const currentUsernames = new Set(screenAudioStreams.map((rs) => rs.username))

        screenNodesRef.current.forEach((nodes, username) => {
            if (!currentUsernames.has(username)) {
                nodes.source.disconnect()
                nodes.gain.disconnect()
                screenNodesRef.current.delete(username)
            }
        })

        for (const rs of screenAudioStreams) {
            const existing = screenNodesRef.current.get(rs.username)
            if (existing) {
                const vol = screenAudioVolumes.get(rs.username) ?? 1
                existing.gain.gain.value = vol
                continue
            }

            try {
                const ctx = getCtx()
                const source = ctx.createMediaStreamSource(rs.stream)
                const gain = ctx.createGain()
                gain.gain.value = screenAudioVolumes.get(rs.username) ?? 1
                source.connect(gain)
                gain.connect(ctx.destination)
                screenNodesRef.current.set(rs.username, { source, gain })
            } catch (err) {
                console.error(`[audio] failed to create screen audio nodes for ${rs.username}:`, err)
            }
        }
    }, [screenAudioStreams, screenAudioVolumes, getCtx])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            nodesRef.current.forEach((nodes) => {
                nodes.source.disconnect()
                nodes.gain.disconnect()
            })
            nodesRef.current.clear()
            screenNodesRef.current.forEach((nodes) => {
                nodes.source.disconnect()
                nodes.gain.disconnect()
            })
            screenNodesRef.current.clear()
            if (audioCtxRef.current) {
                audioCtxRef.current.close()
                audioCtxRef.current = null
            }
        }
    }, [])

    const setVolume = useCallback((username: string, volume: number) => {
        const nodes = nodesRef.current.get(username)
        if (nodes) {
            nodes.gain.gain.value = volume
        }
    }, [])

    const setScreenAudioVolume = useCallback((username: string, volume: number) => {
        const nodes = screenNodesRef.current.get(username)
        if (nodes) {
            nodes.gain.gain.value = volume
        }
    }, [])

    return { setVolume, setScreenAudioVolume }
}

/**
 * MediaPanel — video grid + call controls for WebRTC voice/video/screenshare.
 * Supports grid mode and pinned user mode.
 */
export function MediaPanel({
    localStream,
    screenStream,
    remoteStreams,
    remoteScreenAudioStreams,
    isInCall,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    connectedUsers,
    currentUsername,
    isConnected,
    chatOpen,
    onJoinCall,
    onLeaveCall,
    onToggleMic,
    onToggleCamera,
    onToggleScreenShare,
    onToggleChat,
}: MediaPanelProps) {
    const [pinnedUser, setPinnedUser] = useState<string | null>(null)
    // 'none' = grid, 'spotlight' = large + strip, 'fullscreen' = pinned only
    const [pinMode, setPinMode] = useState<'none' | 'spotlight' | 'fullscreen'>('none')
    const [volumes, setVolumes] = useState<Map<string, number>>(new Map())
    const [screenAudioVolumes, setScreenAudioVolumes] = useState<Map<string, number>>(new Map())
    const [isDeafened, setIsDeafened] = useState(false)
    const [showQualityPicker, setShowQualityPicker] = useState(false)

    const { setVolume: setAudioVolume, setScreenAudioVolume } = useRemoteAudio(
        remoteStreams, volumes, remoteScreenAudioStreams, screenAudioVolumes
    )

    const otherUsers = connectedUsers.filter((u) => u !== currentUsername)

    // Set of usernames who are currently sharing screen audio
    const screenAudioUsers = new Set(remoteScreenAudioStreams.map((rs) => rs.username))

    const handleVolumeChange = useCallback((username: string, volume: number) => {
        setVolumes((prev) => {
            const next = new Map(prev)
            next.set(username, volume)
            return next
        })
        setAudioVolume(username, volume)
    }, [setAudioVolume])

    const handleScreenAudioVolumeChange = useCallback((username: string, volume: number) => {
        setScreenAudioVolumes((prev) => {
            const next = new Map(prev)
            next.set(username, volume)
            return next
        })
        setScreenAudioVolume(username, volume)
    }, [setScreenAudioVolume])

    const handleDeafen = useCallback(() => {
        const newDeafened = !isDeafened
        setIsDeafened(newDeafened)
        remoteStreams.forEach((rs) => {
            const vol = newDeafened ? 0 : (volumes.get(rs.username) ?? 1)
            setAudioVolume(rs.username, vol)
        })
        remoteScreenAudioStreams.forEach((rs) => {
            const vol = newDeafened ? 0 : (screenAudioVolumes.get(rs.username) ?? 1)
            setScreenAudioVolume(rs.username, vol)
        })
    }, [isDeafened, remoteStreams, remoteScreenAudioStreams, volumes, screenAudioVolumes, setAudioVolume, setScreenAudioVolume])

    // Pin a user with a specific mode, or unpin
    const handlePinMode = useCallback((username: string, mode: 'spotlight' | 'fullscreen' | 'none') => {
        if (mode === 'none') {
            setPinnedUser(null)
            setPinMode('none')
        } else {
            setPinnedUser(username)
            setPinMode(mode)
        }
    }, [])

    // Unpin if the pinned user disconnects
    useEffect(() => {
        if (pinnedUser && !remoteStreams.some((rs) => rs.username === pinnedUser) && pinnedUser !== currentUsername) {
            setPinnedUser(null)
            setPinMode('none')
        }
    }, [remoteStreams, pinnedUser, currentUsername])

    // ─── Not in a call — show join screen ───
    if (!isInCall) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 flex items-center justify-center bg-slate-800/30 border border-slate-700/50 rounded-xl">
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 mx-auto rounded-full bg-slate-700/50 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                                <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-300">Voice & Video</h3>
                        <p className="text-sm text-slate-500 max-w-sm">
                            Start a call to chat with voice, video, and screen sharing.
                            {otherUsers.length > 0
                                ? ` ${otherUsers.length} other user${otherUsers.length > 1 ? 's' : ''} online.`
                                : ' No other users online yet.'}
                        </p>
                        <button
                            onClick={onJoinCall}
                            disabled={!isConnected}
                            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                        >
                            Join Call
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Build tile list: local + remotes ───
    const localDisplayStream = isScreenSharing && screenStream ? screenStream : localStream
    const localLabel = `${currentUsername} (You)${isScreenSharing ? ' - Screen' : ''}`

    interface TileData {
        username: string
        stream: MediaStream | null
        label: string
        isLocal: boolean
        mirrored: boolean
    }

    const tiles: TileData[] = [
        { username: currentUsername, stream: localDisplayStream, label: localLabel, isLocal: true, mirrored: !isScreenSharing },
        ...remoteStreams.map((rs) => ({
            username: rs.username,
            stream: rs.stream,
            label: rs.username,
            isLocal: false,
            mirrored: false,
        })),
    ]

    const pinnedTile = pinnedUser ? tiles.find((t) => t.username === pinnedUser) : null
    const unpinnedTiles = pinnedUser ? tiles.filter((t) => t.username !== pinnedUser) : tiles

    // Grid columns based on tile count
    const totalUnpinned = unpinnedTiles.length
    const gridCols = pinnedUser
        ? '' // Horizontal strip — no grid needed
        : totalUnpinned <= 1 ? 'grid-cols-1'
        : totalUnpinned <= 4 ? 'grid-cols-2'
        : 'grid-cols-3'

    return (
        <div className="flex flex-col h-full gap-3 overflow-hidden">
            {/* Video area — takes all remaining space above control bar */}
            <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
                {pinnedUser && pinnedTile && pinMode === 'fullscreen' ? (
                    /* Fullscreen pin — pinned user fills entire video area */
                    <div className="flex-1 min-h-0">
                        <VideoTile
                            stream={pinnedTile.stream}
                            label={pinnedTile.label}
                            mirrored={pinnedTile.mirrored}
                            isLocal={pinnedTile.isLocal}
                            isPinned
                            pinMode="fullscreen"
                            volume={pinnedTile.isLocal ? undefined : (volumes.get(pinnedTile.username) ?? 1)}
                            onPinMode={(mode) => handlePinMode(pinnedTile.username, mode)}
                            onVolumeChange={pinnedTile.isLocal ? undefined : (v) => handleVolumeChange(pinnedTile.username, v)}
                            screenAudioVolume={!pinnedTile.isLocal && screenAudioUsers.has(pinnedTile.username) ? (screenAudioVolumes.get(pinnedTile.username) ?? 1) : undefined}
                            onScreenAudioVolumeChange={!pinnedTile.isLocal && screenAudioUsers.has(pinnedTile.username) ? (v) => handleScreenAudioVolumeChange(pinnedTile.username, v) : undefined}
                        />
                    </div>
                ) : pinnedUser && pinnedTile && pinMode === 'spotlight' ? (
                    <>
                        {/* Spotlight pin — large + strip */}
                        <div className="h-[70%] flex-shrink-0">
                            <div className="h-full w-full">
                                <VideoTile
                                    stream={pinnedTile.stream}
                                    label={pinnedTile.label}
                                    mirrored={pinnedTile.mirrored}
                                    isLocal={pinnedTile.isLocal}
                                    isPinned
                                    pinMode="spotlight"
                                    volume={pinnedTile.isLocal ? undefined : (volumes.get(pinnedTile.username) ?? 1)}
                                    onPinMode={(mode) => handlePinMode(pinnedTile.username, mode)}
                                    onVolumeChange={pinnedTile.isLocal ? undefined : (v) => handleVolumeChange(pinnedTile.username, v)}
                                    screenAudioVolume={!pinnedTile.isLocal && screenAudioUsers.has(pinnedTile.username) ? (screenAudioVolumes.get(pinnedTile.username) ?? 1) : undefined}
                                    onScreenAudioVolumeChange={!pinnedTile.isLocal && screenAudioUsers.has(pinnedTile.username) ? (v) => handleScreenAudioVolumeChange(pinnedTile.username, v) : undefined}
                                />
                            </div>
                        </div>
                        {unpinnedTiles.length > 0 && (
                            <div className="flex-1 flex gap-2 overflow-x-auto overflow-y-hidden min-h-0">
                                {unpinnedTiles.map((tile) => (
                                    <div key={tile.username} className="flex-shrink-0 h-full" style={{ aspectRatio: '16/9' }}>
                                        <VideoTile
                                            stream={tile.stream}
                                            label={tile.label}
                                            mirrored={tile.mirrored}
                                            isLocal={tile.isLocal}
                                            volume={tile.isLocal ? undefined : (volumes.get(tile.username) ?? 1)}
                                            onPinMode={(mode) => handlePinMode(tile.username, mode)}
                                            onVolumeChange={tile.isLocal ? undefined : (v) => handleVolumeChange(tile.username, v)}
                                            screenAudioVolume={!tile.isLocal && screenAudioUsers.has(tile.username) ? (screenAudioVolumes.get(tile.username) ?? 1) : undefined}
                                            onScreenAudioVolumeChange={!tile.isLocal && screenAudioUsers.has(tile.username) ? (v) => handleScreenAudioVolumeChange(tile.username, v) : undefined}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    /* Grid mode */
                    <div className={`flex-1 grid ${gridCols} gap-2 auto-rows-fr min-h-0`}>
                        {tiles.map((tile) => (
                            <VideoTile
                                key={tile.username}
                                stream={tile.stream}
                                label={tile.label}
                                mirrored={tile.mirrored}
                                isLocal={tile.isLocal}
                                volume={tile.isLocal ? undefined : (volumes.get(tile.username) ?? 1)}
                                onPinMode={(mode) => handlePinMode(tile.username, mode)}
                                onVolumeChange={tile.isLocal ? undefined : (v) => handleVolumeChange(tile.username, v)}
                                screenAudioVolume={!tile.isLocal && screenAudioUsers.has(tile.username) ? (screenAudioVolumes.get(tile.username) ?? 1) : undefined}
                                onScreenAudioVolumeChange={!tile.isLocal && screenAudioUsers.has(tile.username) ? (v) => handleScreenAudioVolumeChange(tile.username, v) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Control Bar — fixed at bottom, never overlapped */}
            <div className="flex-shrink-0 flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                {/* Mute mic */}
                <ControlButton
                    active={!isMicOn}
                    danger={!isMicOn}
                    onClick={onToggleMic}
                    title={isMicOn ? 'Mute mic' : 'Unmute mic'}
                    label={isMicOn ? 'Mute' : 'Unmute'}
                >
                    {isMicOn ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="2" x2="22" y1="2" y2="22" />
                            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                            <path d="M5 10v2a7 7 0 0 0 12 5.166" />
                            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                    )}
                </ControlButton>

                {/* Deafen (headphones) */}
                <ControlButton
                    active={isDeafened}
                    danger={isDeafened}
                    onClick={handleDeafen}
                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                    label={isDeafened ? 'Deafened' : 'Audio'}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                        {isDeafened && <line x1="2" x2="22" y1="2" y2="22" />}
                    </svg>
                </ControlButton>

                {/* Camera toggle */}
                <ControlButton
                    active={!isCameraOn}
                    danger={!isCameraOn}
                    onClick={onToggleCamera}
                    title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                    label={isCameraOn ? 'Cam off' : 'Cam on'}
                >
                    {isCameraOn ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
                            <rect x="2" y="6" width="14" height="12" rx="2" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" />
                            <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
                            <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                    )}
                </ControlButton>

                {/* Screen share */}
                <div className="relative">
                    <ControlButton
                        active={isScreenSharing}
                        highlight={isScreenSharing}
                        onClick={() => {
                            if (isScreenSharing) {
                                onToggleScreenShare()
                            } else {
                                setShowQualityPicker((prev) => !prev)
                            }
                        }}
                        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                        label="Screen"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <line x1="8" x2="16" y1="21" y2="21" />
                            <line x1="12" x2="12" y1="17" y2="21" />
                        </svg>
                    </ControlButton>

                    {/* Quality picker dropdown */}
                    {showQualityPicker && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden z-20 min-w-[160px]">
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                Quality
                            </div>
                            {([
                                { label: 'Data Saver', sub: '720p', height: 720 },
                                { label: 'Normal', sub: '1080p (Recommended)', height: 1080 },
                                { label: 'High Quality', sub: '1440p', height: 1440 },
                            ] as const).map((opt) => (
                                <button
                                    key={opt.height}
                                    className="w-full flex flex-col px-3 py-2 text-left hover:bg-slate-700 transition-colors"
                                    onClick={() => {
                                        setShowQualityPicker(false)
                                        onToggleScreenShare(opt.height)
                                    }}
                                >
                                    <span className="text-xs text-slate-200 font-medium">{opt.label}</span>
                                    <span className="text-[10px] text-slate-500">{opt.sub}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Toggle chat */}
                <ControlButton
                    active={chatOpen}
                    highlight={chatOpen}
                    onClick={onToggleChat}
                    title={chatOpen ? 'Hide chat' : 'Show chat'}
                    label="Chat"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                </ControlButton>

                <div className="w-px h-8 bg-slate-700 mx-1" />

                {/* Leave call */}
                <button
                    onClick={onLeaveCall}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all duration-200 shadow-lg shadow-red-500/20"
                    title="Leave call"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                        <line x1="23" x2="17" y1="1" y2="7" />
                        <line x1="17" x2="23" y1="1" y2="7" />
                    </svg>
                    <span className="text-sm font-medium">Leave</span>
                </button>
            </div>
        </div>
    )
}

/** Reusable control bar button */
function ControlButton({
    children,
    active = false,
    danger = false,
    highlight = false,
    onClick,
    title,
    label,
}: {
    children: React.ReactNode
    active?: boolean
    danger?: boolean
    highlight?: boolean
    onClick: () => void
    title: string
    label: string
}) {
    const bg = danger
        ? 'bg-red-500/80 hover:bg-red-500 text-white'
        : highlight
        ? 'bg-cyan-500/80 hover:bg-cyan-500 text-white'
        : active
        ? 'bg-slate-600 text-white'
        : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'

    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${bg}`}
            title={title}
        >
            {children}
            <span className="text-[10px] font-medium">{label}</span>
        </button>
    )
}
