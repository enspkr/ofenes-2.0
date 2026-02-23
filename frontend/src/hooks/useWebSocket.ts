import { useState, useEffect, useRef, useCallback } from 'react'
import type { Message } from '../types/models'

export type ReadyState = 'connecting' | 'open' | 'closing' | 'closed'

const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30000
const RETRY_MULTIPLIER = 2

interface UseWebSocketOptions {
    token: string | null
    username: string
}

/**
 * useWebSocket — manages a WebSocket connection with auto-reconnect.
 *
 * - Authenticates via JWT token in the query string
 * - Auto-reconnects with exponential backoff on disconnect
 * - Handles React StrictMode double-mount (debounces connection)
 * - Provides typed sendMessage() and raw sendDirect() for WebRTC signaling
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

        if (wsRef.current) {
            wsRef.current.close(1000, 'reconnecting')
            wsRef.current = null
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            if (unmounted.current) return
            setReadyState('open')
            retryMs.current = INITIAL_RETRY_MS
            console.log('[ws] connected')
        }

        ws.onmessage = (event) => {
            if (unmounted.current) return
            // Go's writePump batches messages with \n separator in a single frame
            const rawData = event.data as string
            const parts = rawData.split('\n').filter(Boolean)
            const parsed: Message[] = []
            for (const part of parts) {
                try {
                    parsed.push(JSON.parse(part) as Message)
                } catch (err) {
                    console.error('[ws] failed to parse message part:', err)
                }
            }
            if (parsed.length > 0) {
                setMessages((prev) => [...prev, ...parsed])
            }
        }

        ws.onclose = (event) => {
            if (unmounted.current) return
            setReadyState('closed')
            console.log(`[ws] disconnected (code=${event.code})`)

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
     * Send a typed Message through the WebSocket.
     * Wraps the payload in the standard Message struct format.
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

    /**
     * Send a raw JSON string directly through the WebSocket.
     * Used for WebRTC signaling where we need a custom payload structure
     * but still need the Hub to parse the Message envelope.
     */
    const sendDirect = useCallback((type: Message['type'], payload: string) => {
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
        sendDirect,
        readyState,
        clearMessages: () => setMessages([]),
    }
}
