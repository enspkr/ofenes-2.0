import { useAuth } from './hooks/useAuth'
import { useWebSocket } from './hooks/useWebSocket'
import { useVideoSync } from './hooks/useVideoSync'
import { Login } from './components/Login'
import { Chat } from './components/Chat'
import { VideoPlayer } from './components/VideoPlayer'

function Dashboard() {
    const { user, token, logout } = useAuth()

    const { messages, sendMessage, readyState } = useWebSocket({
        token,
        username: user?.username ?? '',
    })

    const { lastSyncEvent, currentVideoState, syncPlay, syncPause, syncSeek, syncLoad } = useVideoSync({
        messages,
        sendMessage,
        username: user?.username ?? '',
    })

    const isConnected = readyState === 'open'

    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
            {/* Top bar */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    ofenes
                </h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-300 font-medium">{user?.username}</span>
                        <span className="px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/30 rounded-full bg-cyan-500/10">
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

            {/* Main content — two-panel layout */}
            <main className="flex-1 flex overflow-hidden p-4 gap-4">
                {/* Left: Chat */}
                <div className="w-80 min-w-[320px] flex-shrink-0">
                    <Chat
                        messages={messages}
                        onSend={sendMessage}
                        readyState={readyState}
                        currentUsername={user?.username ?? ''}
                    />
                </div>

                {/* Right: Video Player */}
                <div className="flex-1 flex flex-col min-w-0">
                    <VideoPlayer
                        lastSyncEvent={lastSyncEvent}
                        currentVideoState={currentVideoState}
                        onPlay={syncPlay}
                        onPause={syncPause}
                        onSeek={syncSeek}
                        onLoad={syncLoad}
                        isConnected={isConnected}
                    />
                </div>
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
