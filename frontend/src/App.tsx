import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { Login } from './components/Login'

interface ApiResponse {
    message: string
    status: string
}

function Dashboard() {
    const { user, token, logout } = useAuth()
    const [greeting, setGreeting] = useState<string>('Loading...')
    const [apiStatus, setApiStatus] = useState<'loading' | 'ok' | 'error'>('loading')

    useEffect(() => {
        fetch('/api/hello')
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json() as Promise<ApiResponse>
            })
            .then((data) => {
                setGreeting(data.message)
                setApiStatus('ok')
            })
            .catch((err) => {
                console.error('Failed to fetch /api/hello:', err)
                setGreeting('Failed to connect to backend')
                setApiStatus('error')
            })
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center space-y-6">
                {/* User info + Logout */}
                <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-300 font-medium">{user?.username}</span>
                        <span className="px-2 py-0.5 text-xs font-mono text-cyan-400 border border-cyan-500/30 rounded-full bg-cyan-500/10">
                            {user?.role}
                        </span>
                    </div>
                    <button
                        onClick={logout}
                        className="text-sm text-slate-500 hover:text-red-400 transition-colors duration-200"
                    >
                        Logout
                    </button>
                </div>

                {/* Status */}
                <div className="flex items-center justify-center gap-2">
                    <span
                        className={`inline-block w-3 h-3 rounded-full ${apiStatus === 'ok'
                                ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse'
                                : apiStatus === 'error'
                                    ? 'bg-red-400 shadow-lg shadow-red-400/50'
                                    : 'bg-amber-400 shadow-lg shadow-amber-400/50 animate-pulse'
                            }`}
                    />
                    <span className="text-sm font-mono text-slate-400 uppercase tracking-widest">
                        {apiStatus === 'ok' ? 'Backend Connected' : apiStatus === 'error' ? 'Disconnected' : 'Connecting...'}
                    </span>
                </div>

                {/* Heading */}
                <h1 className="text-6xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    ofenes
                </h1>

                {/* API Response */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl px-8 py-4 shadow-2xl">
                    <p className="text-sm text-slate-500 font-mono mb-1">GET /api/hello</p>
                    <p className="text-xl text-slate-200 font-medium">{greeting}</p>
                </div>

                {/* Token preview */}
                {token && (
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl px-8 py-4 shadow-2xl max-w-md">
                        <p className="text-sm text-slate-500 font-mono mb-1">JWT Token</p>
                        <p className="text-xs text-slate-400 font-mono break-all">
                            {token.substring(0, 20)}...{token.substring(token.length - 20)}
                        </p>
                    </div>
                )}

                {/* Tech stack badges */}
                <div className="flex items-center justify-center gap-3 pt-4">
                    {['Go', 'React', 'TypeScript', 'Tailwind', 'WebSocket', 'JWT'].map((tech) => (
                        <span
                            key={tech}
                            className="px-3 py-1 text-xs font-mono text-slate-400 border border-slate-700 rounded-full bg-slate-800/30 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors duration-300"
                        >
                            {tech}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

function App() {
    const auth = useAuth()

    // Show login if not authenticated
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

    // Show dashboard if authenticated
    return <Dashboard />
}

export default App
