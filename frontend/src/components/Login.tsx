import { useState } from 'react'

interface LoginProps {
    onLogin: (username: string, password: string) => Promise<boolean>
    onRegister: (username: string, password: string) => Promise<boolean>
    error: string | null
    loading: boolean
}

export function Login({ onLogin, onRegister, error, loading }: LoginProps) {
    const [isRegister, setIsRegister] = useState(false)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isRegister) {
            await onRegister(username, password)
        } else {
            await onLogin(username, password)
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4"
            style={{ background: 'linear-gradient(to bottom right, var(--bg-base), var(--bg-surface), var(--bg-base))' }}
        >
            <div className="w-full max-w-md">
                {/* Logo */}
                <h1
                    className="text-5xl font-bold text-center mb-8 bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(to right, var(--accent-light), var(--accent), var(--accent-secondary))' }}
                >
                    ofenes
                </h1>

                {/* Card */}
                <div
                    className="backdrop-blur-sm rounded-2xl p-8 shadow-2xl"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                    <h2 className="text-xl font-semibold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
                        {isRegister ? 'Create Account' : 'Welcome Back'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                className="w-full px-4 py-2.5 rounded-lg outline-none transition-all duration-200"
                                style={{
                                    backgroundColor: 'var(--bg-input)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                }}
                                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--accent-ring)'; e.target.style.borderColor = 'var(--accent-ring)' }}
                                onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border)' }}
                                placeholder="Enter your username"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete={isRegister ? 'new-password' : 'current-password'}
                                className="w-full px-4 py-2.5 rounded-lg outline-none transition-all duration-200"
                                style={{
                                    backgroundColor: 'var(--bg-input)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                }}
                                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--accent-ring)'; e.target.style.borderColor = 'var(--accent-ring)' }}
                                onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border)' }}
                                placeholder={isRegister ? 'Min. 6 characters' : 'Enter your password'}
                            />
                        </div>

                        {error && (
                            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 px-4 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            style={{
                                backgroundImage: 'linear-gradient(to right, var(--accent), var(--accent-dark))',
                                color: 'var(--text-on-accent)',
                                boxShadow: '0 4px 14px var(--accent-shadow)',
                            }}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {isRegister ? 'Creating...' : 'Signing in...'}
                                </span>
                            ) : (
                                isRegister ? 'Create Account' : 'Sign In'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-sm transition-colors duration-200"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-light)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                        >
                            {isRegister
                                ? 'Already have an account? Sign in'
                                : "Don't have an account? Create one"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
