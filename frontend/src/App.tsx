import { useState, useRef, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTheme, ACCENT_PRESETS, THEME_PRESETS } from './hooks/useTheme'
import { useWebSocket } from './hooks/useWebSocket'
import { useWebRTC } from './hooks/useWebRTC'
import { Login } from './components/Login'
import { Chat } from './components/Chat'
import { MediaPanel } from './components/MediaPanel'

const DEFAULT_CHAT_WIDTH = 340

function ThemePicker() {
    const { mode, accentColor, presetName, toggleMode, setAccentColor, setPreset } = useTheme()
    const [open, setOpen] = useState(false)
    const [customHex, setCustomHex] = useState('')
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((p) => !p)}
                className="w-7 h-7 rounded-full border-2 transition-colors duration-200"
                style={{
                    backgroundColor: accentColor,
                    borderColor: 'var(--border)',
                }}
                title="Theme settings"
            />
            {open && (
                <div
                    className="absolute right-0 top-10 z-50 w-64 rounded-xl p-4 shadow-lg border backdrop-blur-sm"
                    style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                    }}
                >
                    {/* Theme presets */}
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Themes
                    </span>
                    <div className="flex gap-2 mb-3">
                        {THEME_PRESETS.map((tp) => (
                            <button
                                key={tp.name}
                                onClick={() => setPreset(tp.name)}
                                className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all duration-150"
                                style={{
                                    border: presetName === tp.name
                                        ? '2px solid var(--accent)'
                                        : '1px solid var(--border)',
                                    backgroundColor: presetName === tp.name ? 'var(--accent-bg)' : 'transparent',
                                }}
                                title={tp.name}
                            >
                                <div className="flex gap-0.5">
                                    {tp.preview.map((color, i) => (
                                        <div
                                            key={i}
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    {tp.name}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="h-px mb-3" style={{ backgroundColor: 'var(--border)' }} />

                    {/* Mode toggle */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            Custom
                        </span>
                        <button
                            onClick={toggleMode}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                            style={{
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                            }}
                        >
                            {mode === 'dark' ? (
                                <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                                    Dark
                                </>
                            ) : (
                                <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                                    Light
                                </>
                            )}
                        </button>
                    </div>

                    {/* Accent colors */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {ACCENT_PRESETS.map((p) => (
                            <button
                                key={p.name}
                                onClick={() => setAccentColor(p.hex, p.name)}
                                className="w-9 h-9 rounded-full transition-transform hover:scale-110"
                                style={{
                                    backgroundColor: p.hex,
                                    outline: !presetName && accentColor === p.hex ? '2px solid var(--text-primary)' : 'none',
                                    outlineOffset: '2px',
                                }}
                                title={p.name}
                            />
                        ))}
                    </div>

                    {/* Custom hex */}
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            value={customHex}
                            onChange={(e) => setCustomHex(e.target.value)}
                            placeholder="#hex"
                            maxLength={7}
                            className="flex-1 px-2 py-1 rounded-lg text-xs font-mono outline-none"
                            style={{
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                            }}
                        />
                        <button
                            onClick={() => {
                                if (/^#[0-9a-fA-F]{6}$/.test(customHex)) {
                                    setAccentColor(customHex, 'Custom')
                                }
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            Set
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

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
        <div className="h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom right, var(--bg-base), var(--bg-surface), var(--bg-base))' }}>
            {/* Top bar */}
            <header
                className="relative z-50 flex items-center justify-between px-5 py-2.5 backdrop-blur-sm"
                style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'color-mix(in srgb, var(--bg-base) 80%, transparent)' }}
            >
                {/* Left: Online users */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span className="text-xs font-medium">
                            Online <span className="font-bold" style={{ color: 'var(--accent-light)' }}>#{webrtc.connectedUsers.length}</span>
                        </span>
                    </div>
                </div>

                {/* Center: Branding */}
                <h1
                    className="text-lg font-bold bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(to right, var(--accent-light), var(--accent), var(--accent-secondary))' }}
                >
                    ofenes
                </h1>

                {/* Right: User info + theme + logout */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                                backgroundImage: 'linear-gradient(to bottom right, var(--accent-light), var(--accent))',
                                color: 'var(--text-on-accent)',
                            }}
                        >
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>@{user?.username}</span>
                        <span
                            className="px-1.5 py-0.5 text-[9px] font-mono rounded"
                            style={{
                                color: 'var(--accent-light)',
                                border: '1px solid var(--accent-border)',
                                backgroundColor: 'var(--accent-bg)',
                            }}
                        >
                            {user?.role}
                        </span>
                    </div>
                    <ThemePicker />
                    <button
                        onClick={logout}
                        className="text-xs hover:text-red-400 transition-colors duration-200"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex overflow-hidden p-3 gap-0">
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
