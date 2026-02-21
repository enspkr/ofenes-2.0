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
    userId: string
    username: string
}

/**
 * useWebSocket — manages a WebSocket connection with auto-reconnect.
 *
 * - Authenticates via JWT token in the query string
 * - Auto-reconnects with exponential backoff on disconnect
 * - Provides typed sendMessage() and message history
 *
 * Usage:
 *   const { messages, sendMessage, readyState } = useWebSocket({
 *     token, userId: user.id, username: user.username
 *   })
 */
export function useWebSocket({ token, userId, username: _username }: UseWebSocketOptions) {
    // _username is available for future use (e.g., display in outgoing messages)
    void _username
    const [messages, setMessages] = useState<Message[]>([])
    const [readyState, setReadyState] = useState<ReadyState>('closed')

    const wsRef = useRef<WebSocket | null>(null)
    const retryMs = useRef(INITIAL_RETRY_MS)
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const unmounted = useRef(false)

    const connect = useCallback(() => {
        if (!token || unmounted.current) return

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
                console.log(`[ws] reconnecting in ${retryMs.current}ms...`)
                retryMs.current = Math.min(retryMs.current * RETRY_MULTIPLIER, MAX_RETRY_MS)
                connect()
            }, retryMs.current)
        }

        ws.onerror = () => {
            if (unmounted.current) return
            setReadyState('closed')
            // onclose will fire after onerror, triggering reconnect
        }
    }, [token])

    // Connect on mount / token change
    useEffect(() => {
        unmounted.current = false
        connect()

        return () => {
            unmounted.current = true
            clearTimeout(retryTimeout.current)
            if (wsRef.current) {
                wsRef.current.close(1000, 'component unmounted')
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
            sender: userId,
            payload,
            timestamp: new Date().toISOString(),
        }

        wsRef.current.send(JSON.stringify(msg))
    }, [userId])

    return {
        messages,
        sendMessage,
        readyState,
        clearMessages: () => setMessages([]),
    }
}
