import { useState, useRef, useEffect, useCallback } from 'react'
import ReactPlayer from 'react-player'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Player = ReactPlayer as any
import type { VideoSyncPayload } from '../types/models'

interface VideoPlayerProps {
    lastSyncEvent: VideoSyncPayload | null
    currentVideoState: VideoSyncPayload | null
    onPlay: (url: string, timestamp: number) => void
    onPause: (url: string, timestamp: number) => void
    onSeek: (url: string, playing: boolean, timestamp: number) => void
    onLoad: (url: string) => void
    isConnected: boolean
}

/**
 * VideoPlayer — synchronized video player with URL input.
 * Broadcasts play/pause/seek events and reacts to remote sync commands.
 */
export function VideoPlayer({
    lastSyncEvent,
    currentVideoState,
    onPlay,
    onPause,
    onSeek,
    onLoad,
    isConnected,
}: VideoPlayerProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null)
    const [url, setUrl] = useState(currentVideoState?.url ?? '')
    const [playing, setPlaying] = useState(currentVideoState?.playing ?? false)
    const [urlInput, setUrlInput] = useState('')
    const isRemoteAction = useRef(false)
    const lastProgressTime = useRef(0)

    // --- React to remote sync events ---
    useEffect(() => {
        if (!lastSyncEvent) return

        isRemoteAction.current = true

        switch (lastSyncEvent.event) {
            case 'load':
                setUrl(lastSyncEvent.url)
                setPlaying(false)
                break
            case 'play':
                setUrl(lastSyncEvent.url)
                setPlaying(true)
                if (playerRef.current) {
                    const currentTime = playerRef.current.getCurrentTime()
                    if (Math.abs(currentTime - lastSyncEvent.timestamp) > 2) {
                        playerRef.current.seekTo(lastSyncEvent.timestamp, 'seconds')
                    }
                }
                break
            case 'pause':
                setPlaying(false)
                break
            case 'seek':
                setPlaying(lastSyncEvent.playing)
                if (playerRef.current) {
                    playerRef.current.seekTo(lastSyncEvent.timestamp, 'seconds')
                }
                break
        }

        setTimeout(() => {
            isRemoteAction.current = false
        }, 300)
    }, [lastSyncEvent])

    // --- Initialize from Hub state (for late joiners / F5 refresh) ---
    // Watches for the first non-null currentVideoState when no local URL is set.
    // Uses a ref to avoid re-initializing after the user has already loaded a video.
    const initialized = useRef(false)
    useEffect(() => {
        if (initialized.current || !currentVideoState || url) return
        initialized.current = true
        setUrl(currentVideoState.url)
        setPlaying(currentVideoState.playing)
        // Seek after a short delay to ensure the player is ready
        if (currentVideoState.timestamp > 0) {
            setTimeout(() => {
                if (playerRef.current) {
                    playerRef.current.seekTo(currentVideoState.timestamp, 'seconds')
                }
            }, 1000)
        }
    }, [currentVideoState, url])

    // --- Local event handlers (broadcast to others) ---
    const handlePlay = useCallback(() => {
        setPlaying(true)
        if (!isRemoteAction.current && playerRef.current) {
            onPlay(url, playerRef.current.getCurrentTime())
        }
    }, [url, onPlay])

    const handlePause = useCallback(() => {
        setPlaying(false)
        if (!isRemoteAction.current && playerRef.current) {
            onPause(url, playerRef.current.getCurrentTime())
        }
    }, [url, onPause])

    // Detect seeks via progress jumps — if position changes by > 3s, it's a seek
    const handleProgress = useCallback((state: { playedSeconds: number }) => {
        const delta = Math.abs(state.playedSeconds - lastProgressTime.current)
        if (delta > 3 && !isRemoteAction.current && lastProgressTime.current > 0) {
            onSeek(url, playing, state.playedSeconds)
        }
        lastProgressTime.current = state.playedSeconds
    }, [url, playing, onSeek])

    const handleLoadUrl = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = urlInput.trim()
        if (!trimmed) return
        setUrl(trimmed)
        setPlaying(false)
        setUrlInput('')
        onLoad(trimmed)
    }

    const hasVideo = Boolean(url)

    return (
        <div className="flex flex-col h-full">
            {/* URL Input */}
            <form
                onSubmit={handleLoadUrl}
                className="flex items-center gap-2 mb-4"
            >
                <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={!isConnected}
                    placeholder="Paste a YouTube, Vimeo, or video URL..."
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 disabled:opacity-50"
                    style={{
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                    }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--accent-ring)'; e.target.style.borderColor = 'var(--accent-ring)' }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border)' }}
                />
                <button
                    type="submit"
                    disabled={!isConnected || !urlInput.trim()}
                    className="px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                    style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--text-on-accent)',
                    }}
                >
                    Load
                </button>
            </form>

            {/* Player */}
            {hasVideo ? (
                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative">
                    {
                        // @ts-ignore -- react-player types omit 'url' prop but it works at runtime
                        <Player
                            ref={playerRef}
                            url={url}
                            playing={playing}
                            controls
                            width="100%"
                            height="100%"
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onProgress={handleProgress}
                            progressInterval={500}
                            style={{ position: 'absolute', top: 0, left: 0 }}
                        />
                    }
                </div>
            ) : (
                <div
                    className="w-full aspect-video flex items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}
                >
                    <div className="text-center space-y-3">
                        <div className="text-5xl">🎬</div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>No video loaded</h3>
                        <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                            Paste a YouTube, Vimeo, or direct video URL above.
                            Everyone connected will see it sync in real-time.
                        </p>
                    </div>
                </div>
            )}

            {/* Now playing bar */}
            {hasVideo && (
                <div
                    className="mt-3 px-4 py-2 rounded-lg flex items-center gap-2"
                    style={{ backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)' }}
                >
                    <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>Now playing</span>
                    <span className="text-xs truncate flex-1" style={{ color: 'var(--text-tertiary)' }}>{url}</span>
                    <span className={`text-xs font-mono ${playing ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {playing ? '▶ Playing' : '⏸ Paused'}
                    </span>
                </div>
            )}
        </div>
    )
}
