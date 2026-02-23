import { useRef, useEffect } from 'react'
import type { RemoteStream } from '../hooks/useWebRTC'

interface MediaPanelProps {
    localStream: MediaStream | null
    remoteStreams: RemoteStream[]
    isInCall: boolean
    isMicOn: boolean
    isCameraOn: boolean
    isScreenSharing: boolean
    connectedUsers: string[]
    currentUsername: string
    isConnected: boolean
    onJoinCall: () => void
    onLeaveCall: () => void
    onToggleMic: () => void
    onToggleCamera: () => void
    onToggleScreenShare: () => void
}

/** Video tile that auto-plays a MediaStream */
function VideoTile({ stream, label, muted = false, mirrored = false }: {
    stream: MediaStream | null
    label: string
    muted?: boolean
    mirrored?: boolean
}) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
        }
    }, [stream])

    return (
        <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
            />
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md">
                <span className="text-xs text-white font-medium">{label}</span>
            </div>
        </div>
    )
}

/**
 * MediaPanel — video grid + call controls for WebRTC voice/video/screenshare.
 */
export function MediaPanel({
    localStream,
    remoteStreams,
    isInCall,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    connectedUsers,
    currentUsername,
    isConnected,
    onJoinCall,
    onLeaveCall,
    onToggleMic,
    onToggleCamera,
    onToggleScreenShare,
}: MediaPanelProps) {
    const otherUsers = connectedUsers.filter((u) => u !== currentUsername)

    // ─── Not in a call — show join screen ───
    if (!isInCall) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 flex items-center justify-center bg-slate-800/30 border border-slate-700/50 rounded-xl">
                    <div className="text-center space-y-4">
                        <div className="text-5xl">📹</div>
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
                            🎙️ Join Call
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ─── In a call — show video grid + controls ───
    const totalStreams = 1 + remoteStreams.length // local + remotes
    const gridCols = totalStreams <= 1 ? 'grid-cols-1'
        : totalStreams <= 4 ? 'grid-cols-2'
            : 'grid-cols-3'

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Video Grid */}
            <div className={`flex-1 grid ${gridCols} gap-2 auto-rows-fr`}>
                {/* Local video */}
                <VideoTile
                    stream={localStream}
                    label={`${currentUsername} (You)`}
                    muted // Always mute local to prevent echo
                    mirrored={!isScreenSharing} // Mirror camera, not screenshare
                />

                {/* Remote videos */}
                {remoteStreams.map((rs) => (
                    <VideoTile
                        key={rs.username}
                        stream={rs.stream}
                        label={rs.username}
                    />
                ))}
            </div>

            {/* Control Bar */}
            <div className="flex items-center justify-center gap-3 py-3 bg-slate-800/50 border border-slate-700 rounded-xl">
                {/* Mic toggle */}
                <button
                    onClick={onToggleMic}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isMicOn
                            ? 'bg-slate-700 hover:bg-slate-600 text-white'
                            : 'bg-red-500/80 hover:bg-red-500 text-white'
                        }`}
                    title={isMicOn ? 'Mute mic' : 'Unmute mic'}
                >
                    {isMicOn ? '🎙️' : '🔇'}
                </button>

                {/* Camera toggle */}
                <button
                    onClick={onToggleCamera}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isCameraOn
                            ? 'bg-slate-700 hover:bg-slate-600 text-white'
                            : 'bg-red-500/80 hover:bg-red-500 text-white'
                        }`}
                    title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                >
                    {isCameraOn ? '📷' : '🚫'}
                </button>

                {/* Screen share toggle */}
                <button
                    onClick={onToggleScreenShare}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isScreenSharing
                            ? 'bg-cyan-500/80 hover:bg-cyan-500 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                    title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                >
                    🖥️
                </button>

                {/* Leave call */}
                <button
                    onClick={onLeaveCall}
                    className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-red-500/20"
                    title="Leave call"
                >
                    📞
                </button>
            </div>
        </div>
    )
}
