import { useState, useRef, useEffect } from 'react'

interface VideoTileProps {
    stream: MediaStream | null
    label: string
    mirrored?: boolean
    isLocal?: boolean
    isPinned?: boolean
    /** 'spotlight' = large + strip, 'fullscreen' = fills entire area */
    pinMode?: 'spotlight' | 'fullscreen'
    volume?: number
    onPinMode?: (mode: 'spotlight' | 'fullscreen' | 'none') => void
    onVolumeChange?: (volume: number) => void
}

/**
 * useAudioLevel — measures audio level from a MediaStream using Web Audio API.
 * Returns a 0-1 value representing current volume intensity.
 */
function useAudioLevel(stream: MediaStream | null): number {
    const [level, setLevel] = useState(0)
    const animRef = useRef<number>(0)

    useEffect(() => {
        if (!stream) {
            setLevel(0)
            return
        }

        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length === 0) {
            setLevel(0)
            return
        }

        try {
            const ctx = new AudioContext()
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 256
            analyser.smoothingTimeConstant = 0.5
            source.connect(analyser)

            const data = new Uint8Array(analyser.frequencyBinCount)

            const tick = () => {
                analyser.getByteFrequencyData(data)
                let sum = 0
                for (let i = 0; i < data.length; i++) sum += data[i]
                const avg = sum / data.length / 255
                setLevel(avg)
                animRef.current = requestAnimationFrame(tick)
            }
            animRef.current = requestAnimationFrame(tick)

            return () => {
                cancelAnimationFrame(animRef.current)
                source.disconnect()
                ctx.close()
            }
        } catch {
            return
        }
    }, [stream])

    return level
}

/**
 * VideoTile — individual video tile with pin, volume, admin controls, and speaking indicator.
 */
export function VideoTile({
    stream,
    label,
    mirrored = false,
    isLocal = false,
    isPinned = false,
    pinMode,
    volume = 1,
    onPinMode,
    onVolumeChange,
}: VideoTileProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [showControls, setShowControls] = useState(false)
    const [showPinMenu, setShowPinMenu] = useState(false)
    const audioLevel = useAudioLevel(stream)
    const isSpeaking = audioLevel > 0.05

    useEffect(() => {
        const el = videoRef.current
        if (!el || !stream) return
        if (el.srcObject !== stream) {
            el.srcObject = stream
        }
    }, [stream])

    return (
        <div
            className={`relative bg-slate-900 rounded-xl overflow-hidden transition-all duration-200 ${
                isSpeaking ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-400/20' : ''
            } ${isPinned ? 'h-full w-full' : 'aspect-video'}`}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            {/* Video */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full ${isPinned ? 'object-contain' : 'object-cover'} ${mirrored ? 'scale-x-[-1]' : ''}`}
            />

            {/* No video fallback */}
            {!stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-2xl text-slate-400 font-bold">
                        {label.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}

            {/* Overlay controls — shown on hover */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 transition-opacity duration-200 ${
                showControls ? 'opacity-100' : 'opacity-0'
            }`}>
                {/* Top-right: Pin button + dropdown */}
                {onPinMode && (
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                if (isPinned) {
                                    // Already pinned — unpin
                                    onPinMode('none')
                                    setShowPinMenu(false)
                                } else {
                                    // Show menu to choose mode
                                    setShowPinMenu((prev) => !prev)
                                }
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
                                isPinned
                                    ? pinMode === 'fullscreen'
                                        ? 'bg-amber-500/80 text-white'
                                        : 'bg-cyan-500/80 text-white'
                                    : 'bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white'
                            }`}
                            title={isPinned ? 'Unpin' : 'Pin user'}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 17v5" />
                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                            </svg>
                        </button>

                        {/* Pin mode dropdown */}
                        {showPinMenu && !isPinned && (
                            <div className="absolute top-10 right-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden z-10 min-w-[140px]">
                                <button
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPinMode('spotlight')
                                        setShowPinMenu(false)
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 17v5" />
                                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                    </svg>
                                    Spotlight
                                </button>
                                <button
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPinMode('fullscreen')
                                        setShowPinMenu(false)
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                                        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                                        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                                        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                                    </svg>
                                    Fullscreen
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom-left: Admin controls placeholder */}
                {!isLocal && (
                    <button
                        className="absolute bottom-10 left-2 w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-150"
                        title="Admin controls (coming soon)"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                )}

                {/* Bottom-right: Volume slider (remote users only) */}
                {!isLocal && onVolumeChange && (
                    <div className="absolute bottom-10 right-2 flex items-center gap-1.5 bg-black/50 rounded-lg px-2 py-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 flex-shrink-0">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                            {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                        </svg>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="w-20 h-1 accent-cyan-500 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
            </div>

            {/* Audio level bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.min(audioLevel * 300, 100)}%` }}
                />
            </div>

            {/* Username label — always visible */}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md flex items-center gap-1.5">
                {isSpeaking && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <span className="text-xs text-white font-medium">{label}</span>
            </div>
        </div>
    )
}
