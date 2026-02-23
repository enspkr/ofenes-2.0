import { useState, useEffect, useRef, useCallback } from 'react'
import type { Message } from '../types/models'

/** WebSocket ready states matching the browser's WebSocket.readyState */
export type ReadyState = 'connecting' | 'open' | 'closing' | 'closed'

/** Reconnect config */
const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30000
const RETRY_MULTIPLIER = 2

interface UseWebSocketOptions {
    /** JWT token — required for authenticated connections */
    token: string | null
    /** User info for outgoing messages */
    username: string
}

/**
 * useWebSocket — manages a WebSocket connection with auto-reconnect.
 *
 * - Authenticates via JWT token in the query string
 * - Auto-reconnects with exponential backoff on disconnect
 * - Handles React StrictMode double-mount (debounces connection)
 * - Provides typed sendMessage() and message history
 */
export function useWebSocket({ token, username }: UseWebSocketOptions) {
    const [messages, setMessages] = useState<Message[]>([])
    const [readyState, setReadyState] = useState<ReadyState>('closed')

    const wsRef = useRef<WebSocket | null>(null)
    const retryMs = useRef(INITIAL_RETRY_MS)
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const connectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const unmounted = useRef(false)

    const connect = useCallback(() => {
        if (!token || unmounted.current) return

        // Close any existing connection first
        if (wsRef.current) {
            wsRef.current.close(1000, 'reconnecting')
            wsRef.current = null
        }

        // Build WS URL with JWT token
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            if (unmounted.current) return
            setReadyState('open')
            retryMs.current = INITIAL_RETRY_MS // Reset backoff on successful connect
            console.log('[ws] connected')
        }

        ws.onmessage = (event) => {
            if (unmounted.current) return
            try {
                const msg = JSON.parse(event.data as string) as Message
                setMessages((prev) => [...prev, msg])
            } catch (err) {
                console.error('[ws] failed to parse message:', err)
            }
        }

        ws.onclose = (event) => {
            if (unmounted.current) return
            setReadyState('closed')
            console.log(`[ws] disconnected (code=${event.code})`)

            // Auto-reconnect with exponential backoff
            retryTimeout.current = setTimeout(() => {
                if (unmounted.current) return
                console.log(`[ws] reconnecting in ${retryMs.current}ms...`)
                retryMs.current = Math.min(retryMs.current * RETRY_MULTIPLIER, MAX_RETRY_MS)
                connect()
            }, retryMs.current)
        }

        ws.onerror = () => {
            if (unmounted.current) return
            setReadyState('closed')
        }
    }, [token])

    // Connect on mount / token change.
    // Uses a small debounce to handle React StrictMode's double-mount:
    //   Mount 1 → schedule connect → Cleanup → cancel → Mount 2 → schedule connect → fires once
    useEffect(() => {
        unmounted.current = false
        clearTimeout(connectTimeout.current)
        connectTimeout.current = setTimeout(connect, 50)

        return () => {
            unmounted.current = true
            clearTimeout(connectTimeout.current)
            clearTimeout(retryTimeout.current)
            if (wsRef.current) {
                wsRef.current.close(1000, 'component unmounted')
                wsRef.current = null
            }
        }
    }, [connect])

    /**
     * Send a typed message through the WebSocket.
     * The message is JSON-serialized to match Go's models.Message struct.
     */
    const sendMessage = useCallback((type: Message['type'], payload: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn('[ws] cannot send — not connected')
            return
        }

        const msg: Message = {
            type,
            sender: username,
            payload,
            timestamp: new Date().toISOString(),
        }

        wsRef.current.send(JSON.stringify(msg))
    }, [username])

    return {
        messages,
        sendMessage,
        readyState,
        clearMessages: () => setMessages([]),
    }
}
