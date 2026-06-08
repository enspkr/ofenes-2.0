import { useState, useEffect, useCallback, useRef } from 'react'
import type {
    Message,
    GameSession,
    GameTrack,
    SelectedArtist,
    GameRoundStartPayload,
    GameRoundEndPayload,
    GameEndPayload,
} from '../types/models'

interface RoundResult {
    correctVideoId: string
    answers: Record<string, string>
    scores: Record<string, number>
}

interface UseGameOptions {
    messages: Message[]
    sendMessage: (type: Message['type'], payload: string) => void
    token: string | null
}

export interface UseGameReturn {
    session: GameSession | null
    myAnswer: string | null
    roundResult: RoundResult | null
    currentRound: { videoId: string; startSeconds: number; durationMs: number } | null
    startGame: (players?: string[]) => void
    selectMode: (mode: 'artists' | 'genres') => void
    addArtist: (artist: SelectedArtist) => void
    removeArtist: (channelId: string) => void
    selectGenre: (genre: string) => void
    beginGame: (tracks: GameTrack[]) => void
    submitAnswer: (videoId: string) => void
    leaveGame: () => void
    searchArtists: (q: string) => Promise<{ channelId: string; name: string; thumbnailUrl: string }[]>
    getArtistTracks: (channelId: string) => Promise<GameTrack[]>
    getGenres: () => Promise<{ id: string; name: string }[]>
    getGenreTracks: (genre: string) => Promise<GameTrack[]>
}

export function useGame({ messages, sendMessage, token }: UseGameOptions): UseGameReturn {
    const [session, setSession] = useState<GameSession | null>(null)
    const [myAnswer, setMyAnswer] = useState<string | null>(null)
    const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
    const [currentRound, setCurrentRound] = useState<{
        videoId: string
        startSeconds: number
        durationMs: number
    } | null>(null)

    // Track which message indices we've processed to avoid reprocessing
    const processedCount = useRef(0)

    useEffect(() => {
        const gameMsgs = messages.filter((m) => m.type === 'game')
        if (gameMsgs.length <= processedCount.current) return

        const newMsgs = gameMsgs.slice(processedCount.current)
        processedCount.current = gameMsgs.length

        for (const msg of newMsgs) {
            try {
                const payload = JSON.parse(msg.payload) as { action: string } & Record<string, unknown>
                handleGamePayload(payload)
            } catch {
                // malformed payload — ignore
            }
        }
    }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

    function handleGamePayload(payload: { action: string } & Record<string, unknown>) {
        switch (payload.action) {
            case 'game_state': {
                const s = payload.session as GameSession
                setSession(s)
                // Reset per-round state when status changes to a non-active state
                if (s.status !== 'round_active' && s.status !== 'round_result') {
                    setMyAnswer(null)
                    setRoundResult(null)
                    setCurrentRound(null)
                }
                // Late joiner: if round already active, restore video info
                if (s.status === 'round_active' && s.currentVideoId) {
                    setCurrentRound({
                        videoId: s.currentVideoId,
                        startSeconds: s.startSeconds ?? 30,
                        durationMs: 30000,
                    })
                }
                break
            }
            case 'game_round_start': {
                const p = payload as unknown as GameRoundStartPayload
                setMyAnswer(null)
                setRoundResult(null)
                setCurrentRound({
                    videoId: p.videoId,
                    startSeconds: p.startSeconds,
                    durationMs: p.durationMs,
                })
                setSession((prev) =>
                    prev
                        ? {
                              ...prev,
                              status: 'round_active',
                              currentRound: p.roundNumber,
                              totalRounds: p.totalRounds,
                              options: p.options,
                              currentVideoId: p.videoId,
                              startSeconds: p.startSeconds,
                          }
                        : prev
                )
                break
            }
            case 'game_round_end': {
                const p = payload as unknown as GameRoundEndPayload
                setRoundResult({ correctVideoId: p.correctVideoId, answers: p.answers, scores: p.scores })
                setSession((prev) => (prev ? { ...prev, status: 'round_result', scores: p.scores } : prev))
                setCurrentRound(null)
                break
            }
            case 'game_end': {
                const p = payload as unknown as GameEndPayload
                setSession((prev) => (prev ? { ...prev, status: 'ended', scores: p.scores } : prev))
                setCurrentRound(null)
                break
            }
            case 'game_error': {
                console.error('[game] error:', payload.message)
                break
            }
        }
    }

    const send = useCallback(
        (action: string, extra: Record<string, unknown> = {}) => {
            sendMessage('game', JSON.stringify({ action, ...extra }))
        },
        [sendMessage]
    )

    const startGame = useCallback(
        (players?: string[]) => {
            setMyAnswer(null)
            setRoundResult(null)
            setCurrentRound(null)
            send('game_start', { players: players ?? [] })
        },
        [send]
    )

    const selectMode = useCallback(
        (mode: 'artists' | 'genres') => send('game_mode_select', { mode }),
        [send]
    )

    const addArtist = useCallback(
        (artist: SelectedArtist) =>
            send('game_artist_add', {
                channelId: artist.channelId,
                name: artist.name,
                thumbnailUrl: artist.thumbnailUrl,
            }),
        [send]
    )

    const removeArtist = useCallback(
        (channelId: string) => send('game_artist_remove', { channelId }),
        [send]
    )

    const selectGenre = useCallback(
        (genre: string) => send('game_genre_select', { genre }),
        [send]
    )

    const beginGame = useCallback(
        (tracks: GameTrack[]) => send('game_begin', { tracks }),
        [send]
    )

    const submitAnswer = useCallback(
        (videoId: string) => {
            if (myAnswer) return
            setMyAnswer(videoId)
            send('game_answer', { videoId })
        },
        [myAnswer, send]
    )

    const leaveGame = useCallback(() => {
        send('game_leave')
        setSession(null)
        setMyAnswer(null)
        setRoundResult(null)
        setCurrentRound(null)
        processedCount.current = messages.filter((m) => m.type === 'game').length
    }, [send, messages])

    // --- YouTube proxy API calls ---

    const apiFetch = useCallback(
        async (path: string): Promise<unknown> => {
            const res = await fetch(path, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
            if (!res.ok) throw new Error(`API error ${res.status}`)
            return res.json()
        },
        [token]
    )

    const searchArtists = useCallback(
        (q: string) =>
            apiFetch(`/api/game/search/artist?q=${encodeURIComponent(q)}`) as Promise<
                { channelId: string; name: string; thumbnailUrl: string }[]
            >,
        [apiFetch]
    )

    const getArtistTracks = useCallback(
        (channelId: string) =>
            apiFetch(`/api/game/artist/tracks?channelId=${encodeURIComponent(channelId)}`) as Promise<GameTrack[]>,
        [apiFetch]
    )

    const getGenres = useCallback(
        () => apiFetch('/api/game/genres') as Promise<{ id: string; name: string }[]>,
        [apiFetch]
    )

    const getGenreTracks = useCallback(
        (genre: string) =>
            apiFetch(`/api/game/genre/tracks?genre=${encodeURIComponent(genre)}`) as Promise<GameTrack[]>,
        [apiFetch]
    )

    return {
        session,
        myAnswer,
        roundResult,
        currentRound,
        startGame,
        selectMode,
        addArtist,
        removeArtist,
        selectGenre,
        beginGame,
        submitAnswer,
        leaveGame,
        searchArtists,
        getArtistTracks,
        getGenres,
        getGenreTracks,
    }
}
