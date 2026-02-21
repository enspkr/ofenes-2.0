import { useState, useCallback, useEffect } from 'react'
import type { User, AuthResponse, ApiError } from '../types/models'

const TOKEN_KEY = 'ofenes_token'
const USER_KEY = 'ofenes_user'

/**
 * useAuth — custom hook for authentication state management.
 *
 * Provides: login, register, logout, and current user/token state.
 * Persists auth state in localStorage so it survives page refreshes.
 *
 * Usage:
 *   const { user, token, login, register, logout, isAuthenticated, error } = useAuth()
 */
export function useAuth() {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem(USER_KEY)
        return stored ? (JSON.parse(stored) as User) : null
    })

    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem(TOKEN_KEY)
    })

    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    // Persist state changes to localStorage
    useEffect(() => {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token)
        } else {
            localStorage.removeItem(TOKEN_KEY)
        }
    }, [token])

    useEffect(() => {
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user))
        } else {
            localStorage.removeItem(USER_KEY)
        }
    }, [user])

    // --- Auth API calls ---

    const handleAuthResponse = useCallback((data: AuthResponse) => {
        setToken(data.token)
        setUser(data.user)
        setError(null)
    }, [])

    const register = useCallback(async (username: string, password: string) => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            })

            if (!res.ok) {
                const err = (await res.json()) as ApiError
                setError(err.error)
                return false
            }

            const data = (await res.json()) as AuthResponse
            handleAuthResponse(data)
            return true
        } catch {
            setError('Network error — is the backend running?')
            return false
        } finally {
            setLoading(false)
        }
    }, [handleAuthResponse])

    const login = useCallback(async (username: string, password: string) => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            })

            if (!res.ok) {
                const err = (await res.json()) as ApiError
                setError(err.error)
                return false
            }

            const data = (await res.json()) as AuthResponse
            handleAuthResponse(data)
            return true
        } catch {
            setError('Network error — is the backend running?')
            return false
        } finally {
            setLoading(false)
        }
    }, [handleAuthResponse])

    const logout = useCallback(() => {
        setToken(null)
        setUser(null)
        setError(null)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
    }, [])

    return {
        user,
        token,
        error,
        loading,
        isAuthenticated: !!token && !!user,
        register,
        login,
        logout,
    }
}
