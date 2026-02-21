import { useEffect, useState } from 'react'

interface ApiResponse {
    message: string
}

function App() {
    const [greeting, setGreeting] = useState<string>('Loading...')
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

    useEffect(() => {
        fetch('/api/hello')
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json() as Promise<ApiResponse>
            })
            .then((data) => {
                setGreeting(data.message)
                setStatus('ok')
            })
            .catch((err) => {
                console.error('Failed to fetch /api/hello:', err)
                setGreeting('Failed to connect to backend')
                setStatus('error')
            })
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center space-y-6">
                {/* Status indicator */}
                <div className="flex items-center justify-center gap-2">
                    <span
                        className={`inline-block w-3 h-3 rounded-full ${status === 'ok'
                                ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse'
                                : status === 'error'
                                    ? 'bg-red-400 shadow-lg shadow-red-400/50'
                                    : 'bg-amber-400 shadow-lg shadow-amber-400/50 animate-pulse'
                            }`}
                    />
                    <span className="text-sm font-mono text-slate-400 uppercase tracking-widest">
                        {status === 'ok' ? 'Backend Connected' : status === 'error' ? 'Disconnected' : 'Connecting...'}
                    </span>
                </div>

                {/* Main heading */}
                <h1 className="text-6xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    ofenes
                </h1>

                {/* API Response */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl px-8 py-4 shadow-2xl">
                    <p className="text-sm text-slate-500 font-mono mb-1">GET /api/hello</p>
                    <p className="text-xl text-slate-200 font-medium">{greeting}</p>
                </div>

                {/* Tech stack badges */}
                <div className="flex items-center justify-center gap-3 pt-4">
                    {['Go', 'React', 'TypeScript', 'Tailwind', 'WebSocket'].map((tech) => (
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

export default App
