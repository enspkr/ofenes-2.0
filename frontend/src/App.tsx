import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useWebSocket } from './hooks/useWebSocket'
import { useWebRTC } from './hooks/useWebRTC'
import { Login } from './components/Login'
import { Chat } from './components/Chat'
import { MediaPanel } from './components/MediaPanel'

const DEFAULT_CHAT_WIDTH = 340

function Dashboard() {
    const { user, token, logout } = useAuth()

    const { messages, sendMessage, sendDirect, readyState } = useWebSocket({
        token,
        username: user?.username ?? '',
    })

    const isConnected = readyState === 'open'

    const webrtc = useWebRTC({
        messages,
        sendDirect,
        username: user?.username ?? '',
        isConnected,
    })

    const [chatOpen, setChatOpen] = useState(true)
    const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)

    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
            {/* Top bar */}
            <header className="flex items-center justify-between px-5 py-2.5 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
                {/* Left: Online users */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span className="text-xs font-medium">
                            Online <span className="text-cyan-400 font-bold">#{webrtc.connectedUsers.length}</span>
                        </span>
                    </div>
                </div>

                {/* Center: Branding */}
                <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    ofenes
                </h1>

                {/* Right: User info */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-300 font-medium">@{user?.username}</span>
                        <span className="px-1.5 py-0.5 text-[9px] font-mono text-cyan-400 border border-cyan-500/30 rounded bg-cyan-500/10">
                            {user?.role}
                        </span>
                    </div>
                    <button
                        onClick={logout}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors duration-200"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex overflow-hidden p-3 gap-0">
                {/* Media Panel — fills available space */}
                <div className="flex-1 flex flex-col min-w-0">
                    <MediaPanel
                        localStream={webrtc.localStream}
                        screenStream={webrtc.screenStream}
                        remoteStreams={webrtc.remoteStreams}
                        remoteScreenAudioStreams={webrtc.remoteScreenAudioStreams}
                        isInCall={webrtc.isInCall}
                        isMicOn={webrtc.isMicOn}
                        isCameraOn={webrtc.isCameraOn}
                        isScreenSharing={webrtc.isScreenSharing}
                        connectedUsers={webrtc.connectedUsers}
                        currentUsername={user?.username ?? ''}
                        isConnected={isConnected}
                        chatOpen={chatOpen}
                        onJoinCall={webrtc.joinCall}
                        onLeaveCall={webrtc.leaveCall}
                        onToggleMic={webrtc.toggleMic}
                        onToggleCamera={webrtc.toggleCamera}
                        onToggleScreenShare={webrtc.toggleScreenShare}
                        onToggleChat={() => setChatOpen((prev) => !prev)}
                    />
                </div>

                {/* Chat Panel — resizable, conditionally shown */}
                {chatOpen && (
                    <div className="flex-shrink-0">
                        <Chat
                            messages={messages}
                            onSend={sendMessage}
                            readyState={readyState}
                            currentUsername={user?.username ?? ''}
                            connectedUsers={webrtc.connectedUsers}
                            width={chatWidth}
                            onWidthChange={setChatWidth}
                        />
                    </div>
                )}
            </main>
        </div>
    )
}

function App() {
    const auth = useAuth()

    if (!auth.isAuthenticated) {
        return (
            <Login
                onLogin={auth.login}
                onRegister={auth.register}
                error={auth.error}
                loading={auth.loading}
            />
        )
    }

    return <Dashboard />
}

export default App
