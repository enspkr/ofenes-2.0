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

    // --- Initialize from current state on mount ---
    useEffect(() => {
        if (currentVideoState && !url) {
            setUrl(currentVideoState.url)
            setPlaying(currentVideoState.playing)
            if (playerRef.current && currentVideoState.timestamp > 0) {
                playerRef.current.seekTo(currentVideoState.timestamp, 'seconds')
            }
        }
    }, []) // Only on mount

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

    const hasVideo = Boolean(url) && Player.canPlay?.(url) !== false

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
                    className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={!isConnected || !urlInput.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
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
                <div className="w-full aspect-video flex items-center justify-center bg-slate-800/30 border border-slate-700/50 rounded-xl">
                    <div className="text-center space-y-3">
                        <div className="text-5xl">🎬</div>
                        <h3 className="text-lg font-semibold text-slate-300">No video loaded</h3>
                        <p className="text-sm text-slate-500 max-w-sm">
                            Paste a YouTube, Vimeo, or direct video URL above.
                            Everyone connected will see it sync in real-time.
                        </p>
                    </div>
                </div>
            )}

            {/* Now playing bar */}
            {hasVideo && (
                <div className="mt-3 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Now playing</span>
                    <span className="text-xs text-slate-400 truncate flex-1">{url}</span>
                    <span className={`text-xs font-mono ${playing ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {playing ? '▶ Playing' : '⏸ Paused'}
                    </span>
                </div>
            )}
        </div>
    )
}
