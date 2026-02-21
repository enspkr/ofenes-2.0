import { useState } from 'react'

interface LoginProps {
    onLogin: (username: string, password: string) => Promise<boolean>
    onRegister: (username: string, password: string) => Promise<boolean>
    error: string | null
    loading: boolean
}

/**
 * Login — authentication form with toggle between Login and Register.
 * Premium dark theme with glassmorphism and micro-animations.
 */
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <h1 className="text-5xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    ofenes
                </h1>

                {/* Card */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-xl font-semibold text-slate-200 mb-6 text-center">
                        {isRegister ? 'Create Account' : 'Welcome Back'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-slate-400 mb-1.5">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200"
                                placeholder="Enter your username"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-400 mb-1.5">
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
                                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200"
                                placeholder={isRegister ? 'Min. 6 characters' : 'Enter your password'}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40"
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

                    {/* Toggle */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-sm text-slate-400 hover:text-cyan-400 transition-colors duration-200"
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
