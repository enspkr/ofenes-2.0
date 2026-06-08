import { useCallback, useMemo } from 'react'
import type { Message, VideoSyncPayload } from '../types/models'

interface UseVideoSyncOptions {
    /** All WebSocket messages — this hook filters for video_sync only */
    messages: Message[]
    /** Send function from useWebSocket */
    sendMessage: (type: Message['type'], payload: string) => void
    /** Current username — used to ignore own echoes */
    username: string
}

/**
 * useVideoSync — manages synchronized video state across clients.
 *
 * Filters video_sync messages from the WebSocket stream, provides
 * sync functions for play/pause/seek/load, and ignores events
 * triggered by the current user to prevent feedback loops.
 */
export function useVideoSync({ messages, sendMessage, username }: UseVideoSyncOptions) {
    // Get the latest video_sync message (not from ourselves)
    const lastSyncEvent = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].type === 'video_sync') {
                try {
                    const payload = JSON.parse(messages[i].payload) as VideoSyncPayload
                    if (payload.triggeredBy !== username) {
                        return payload
                    }
                } catch {
                    // skip malformed
                }
            }
        }
        return null
    }, [messages, username])

    // Also find the latest video state (including our own) for initial state
    const currentVideoState = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].type === 'video_sync') {
                try {
                    return JSON.parse(messages[i].payload) as VideoSyncPayload
                } catch {
                    // skip
                }
            }
        }
        return null
    }, [messages])

    const sendSync = useCallback((event: VideoSyncPayload['event'], url: string, playing: boolean, timestamp: number) => {
        const payload: VideoSyncPayload = {
            event,
            url,
            playing,
            timestamp,
            triggeredBy: username,
        }
        sendMessage('video_sync', JSON.stringify(payload))
    }, [sendMessage, username])

    const syncPlay = useCallback((url: string, timestamp: number) => {
        sendSync('play', url, true, timestamp)
    }, [sendSync])

    const syncPause = useCallback((url: string, timestamp: number) => {
        sendSync('pause', url, false, timestamp)
    }, [sendSync])

    const syncSeek = useCallback((url: string, playing: boolean, timestamp: number) => {
        sendSync('seek', url, playing, timestamp)
    }, [sendSync])

    const syncLoad = useCallback((url: string) => {
        sendSync('load', url, false, 0)
    }, [sendSync])

    return {
        /** Latest sync event from ANOTHER user (for reacting to) */
        lastSyncEvent,
        /** Latest video state from ANY user (for initial display) */
        currentVideoState,
        syncPlay,
        syncPause,
        syncSeek,
        syncLoad,
    }
}
