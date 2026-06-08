import { useState, useEffect, useRef, useCallback } from 'react'
import type { GameSession, GameTrack, SelectedArtist } from '../types/models'
import type { UseGameReturn } from '../hooks/useGame'

interface GamePanelProps {
    session: GameSession
    myAnswer: string | null
    roundResult: { correctVideoId: string; answers: Record<string, string>; scores: Record<string, number> } | null
    currentRound: { videoId: string; startSeconds: number; durationMs: number } | null
    currentUsername: string
    game: UseGameReturn
}

// ─── YouTube player ──────────────────────────────────────────────────────────

function useYouTubePlayer(
    containerRef: React.RefObject<HTMLDivElement | null>,
    videoInfo: { videoId: string; startSeconds: number } | null
) {
    const playerRef = useRef<YT.Player | null>(null)
    const apiReadyRef = useRef(false)
    const pendingRef = useRef<{ videoId: string; startSeconds: number } | null>(null)

    const loadVideo = useCallback((videoId: string, startSeconds: number) => {
        if (playerRef.current && apiReadyRef.current) {
            playerRef.current.unMute()
            playerRef.current.setVolume(100)
            playerRef.current.loadVideoById({ videoId, startSeconds })
            playerRef.current.playVideo()
        } else {
            pendingRef.current = { videoId, startSeconds }
        }
    }, [])

    // Inject YouTube IFrame API script once
    useEffect(() => {
        if (window.YT) {
            apiReadyRef.current = true
            return
        }
        const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
        if (!existing) {
            const tag = document.createElement('script')
            tag.src = 'https://www.youtube.com/iframe_api'
            document.head.appendChild(tag)
        }

        const prev = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => {
            prev?.()
            apiReadyRef.current = true
            if (containerRef.current && !playerRef.current) {
                createPlayer()
            }
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Create player once container is mounted
    useEffect(() => {
        if (!containerRef.current) return
        if (!window.YT) return
        if (playerRef.current) return
        createPlayer()
    }) // re-check every render until player is created

    function createPlayer() {
        if (!containerRef.current) return
        playerRef.current = new YT.Player(containerRef.current, {
            width: 1,
            height: 1,
            playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0 },
            events: {
                onReady: (event) => {
                    apiReadyRef.current = true
                    event.target.unMute()
                    event.target.setVolume(100)
                    if (pendingRef.current) {
                        event.target.loadVideoById(pendingRef.current)
                        event.target.playVideo()
                        pendingRef.current = null
                    }
                },
            },
        })
    }

    // Load new video when round info changes
    useEffect(() => {
        if (!videoInfo) {
            playerRef.current?.stopVideo()
            return
        }
        loadVideo(videoInfo.videoId, videoInfo.startSeconds)
    }, [videoInfo?.videoId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            playerRef.current?.destroy()
            playerRef.current = null
        }
    }, [])
}

// ─── Lobby ───────────────────────────────────────────────────────────────────

function GameLobby({
    session,
    isHost,
    game,
}: {
    session: GameSession
    isHost: boolean
    game: UseGameReturn
}) {
    const [artistQuery, setArtistQuery] = useState('')
    const [artistResults, setArtistResults] = useState<SelectedArtist[]>([])
    const [artistSearching, setArtistSearching] = useState(false)
    const [genres, setGenres] = useState<{ id: string; name: string }[]>([])
    const [fetchingTracks, setFetchingTracks] = useState(false)
    const [trackCount, setTrackCount] = useState(0)
    const [collectedTracks, setCollectedTracks] = useState<GameTrack[]>([])

    // Fetch genres when genre mode selected
    useEffect(() => {
        if (session.status === 'genre_select' && genres.length === 0) {
            game.getGenres().then(setGenres).catch(console.error)
        }
    }, [session.status]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleArtistSearch = async () => {
        if (!artistQuery.trim()) return
        setArtistSearching(true)
        try {
            const results = await game.searchArtists(artistQuery.trim())
            setArtistResults(results)
        } catch {
            // ignore
        } finally {
            setArtistSearching(false)
        }
    }

    const handleAddArtist = async (artist: SelectedArtist) => {
        game.addArtist(artist)
        setArtistResults([])
        setArtistQuery('')
        // Fetch and accumulate tracks for this artist
        setFetchingTracks(true)
        try {
            const tracks = await game.getArtistTracks(artist.channelId)
            setCollectedTracks((prev) => {
                const ids = new Set(prev.map((t) => t.videoId))
                const fresh = tracks.filter((t) => !ids.has(t.videoId))
                const merged = [...prev, ...fresh]
                setTrackCount(merged.length)
                return merged
            })
        } catch {
            // ignore
        } finally {
            setFetchingTracks(false)
        }
    }

    const handleGenreSelect = async (genreId: string) => {
        game.selectGenre(genreId)
        setFetchingTracks(true)
        setCollectedTracks([])
        try {
            const tracks = await game.getGenreTracks(genreId)
            setCollectedTracks(tracks)
            setTrackCount(tracks.length)
        } catch {
            // ignore
        } finally {
            setFetchingTracks(false)
        }
    }

    const handleBegin = () => {
        if (collectedTracks.length < 4) return
        game.beginGame(collectedTracks)
    }

    // ── Mode selection ──
    if (session.status === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="text-center">
                    <div className="text-4xl mb-2">🎵</div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Guess The Song
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {isHost ? 'Choose how to pick songs' : `Waiting for ${session.host} to set up the game…`}
                    </p>
                </div>

                {isHost && (
                    <div className="flex gap-4">
                        <ModeCard
                            icon="🎤"
                            title="By Artist"
                            desc="Pick artists and guess their songs"
                            onClick={() => game.selectMode('artists')}
                        />
                        <ModeCard
                            icon="🎸"
                            title="By Genre"
                            desc="Pick a genre for a mixed playlist"
                            onClick={() => game.selectMode('genres')}
                        />
                    </div>
                )}
            </div>
        )
    }

    // ── Artist selection ──
    if (session.status === 'artist_select') {
        return (
            <div className="flex flex-col h-full gap-4 overflow-hidden">
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-2xl">🎤</span>
                    <div>
                        <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                            Search Artists
                        </h3>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Add multiple artists — songs from all of them go into the pool
                        </p>
                    </div>
                </div>

                {/* Selected artists */}
                {session.selectedArtists.length > 0 && (
                    <div className="flex flex-wrap gap-2 flex-shrink-0">
                        {session.selectedArtists.map((a) => (
                            <div
                                key={a.channelId}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                                style={{ backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
                            >
                                {a.thumbnailUrl && (
                                    <img src={a.thumbnailUrl} className="w-5 h-5 rounded-full" alt="" />
                                )}
                                <span style={{ color: 'var(--accent-light)' }}>{a.name}</span>
                                {isHost && (
                                    <button
                                        onClick={() => game.removeArtist(a.channelId)}
                                        className="ml-1 opacity-60 hover:opacity-100"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {isHost && (
                    <>
                        {/* Search input */}
                        <div className="flex gap-2 flex-shrink-0">
                            <input
                                type="text"
                                value={artistQuery}
                                onChange={(e) => setArtistQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleArtistSearch()}
                                placeholder="Search artist name…"
                                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                                style={{
                                    backgroundColor: 'var(--bg-input)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <button
                                onClick={handleArtistSearch}
                                disabled={artistSearching}
                                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                                style={{ backgroundColor: 'var(--accent-dark)', color: 'var(--text-on-accent)' }}
                            >
                                {artistSearching ? '…' : 'Search'}
                            </button>
                        </div>

                        {/* Search results */}
                        {artistResults.length > 0 && (
                            <div
                                className="flex-1 overflow-y-auto rounded-xl border p-2 space-y-1"
                                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
                            >
                                {artistResults.map((a) => (
                                    <button
                                        key={a.channelId}
                                        onClick={() => handleAddArtist(a)}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                                        style={{ color: 'var(--text-primary)' }}
                                        onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor = 'var(--bg-overlay)')
                                        }
                                        onMouseLeave={(e) =>
                                            (e.currentTarget.style.backgroundColor = 'transparent')
                                        }
                                    >
                                        {a.thumbnailUrl ? (
                                            <img src={a.thumbnailUrl} className="w-9 h-9 rounded-full" alt="" />
                                        ) : (
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                                                style={{ backgroundColor: 'var(--bg-overlay)' }}
                                            >
                                                🎤
                                            </div>
                                        )}
                                        <span className="text-sm font-medium">{a.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-between flex-shrink-0">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {fetchingTracks
                                    ? 'Loading songs…'
                                    : trackCount > 0
                                    ? `${trackCount} songs in pool`
                                    : 'No songs yet'}
                            </span>
                            <button
                                onClick={handleBegin}
                                disabled={collectedTracks.length < 4 || fetchingTracks}
                                className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                                style={{
                                    backgroundImage: 'linear-gradient(to right, var(--accent-light), var(--accent))',
                                    color: 'var(--text-on-accent)',
                                }}
                            >
                                Start Game →
                            </button>
                        </div>
                    </>
                )}

                {!isHost && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Waiting for {session.host} to add artists and start the game…
                    </p>
                )}
            </div>
        )
    }

    // ── Genre selection ──
    if (session.status === 'genre_select') {
        return (
            <div className="flex flex-col h-full gap-4 overflow-hidden">
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-2xl">🎸</span>
                    <div>
                        <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                            Pick a Genre
                        </h3>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Songs from this genre will be loaded into the pool
                        </p>
                    </div>
                </div>

                {isHost && (
                    <>
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-3 gap-2">
                                {genres.map((g) => (
                                    <button
                                        key={g.id}
                                        onClick={() => handleGenreSelect(g.id)}
                                        className="px-3 py-3 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            backgroundColor:
                                                session.selectedGenre === g.id
                                                    ? 'var(--accent-bg)'
                                                    : 'var(--bg-card)',
                                            border:
                                                session.selectedGenre === g.id
                                                    ? '2px solid var(--accent)'
                                                    : '1px solid var(--border)',
                                            color:
                                                session.selectedGenre === g.id
                                                    ? 'var(--accent-light)'
                                                    : 'var(--text-primary)',
                                        }}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between flex-shrink-0">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {fetchingTracks
                                    ? 'Loading songs…'
                                    : trackCount > 0
                                    ? `${trackCount} songs in pool`
                                    : session.selectedGenre
                                    ? 'No songs found'
                                    : 'Select a genre above'}
                            </span>
                            <button
                                onClick={handleBegin}
                                disabled={collectedTracks.length < 4 || fetchingTracks}
                                className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                                style={{
                                    backgroundImage: 'linear-gradient(to right, var(--accent-light), var(--accent))',
                                    color: 'var(--text-on-accent)',
                                }}
                            >
                                Start Game →
                            </button>
                        </div>
                    </>
                )}

                {!isHost && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Waiting for {session.host} to pick a genre and start the game…
                    </p>
                )}
            </div>
        )
    }

    return null
}

function ModeCard({
    icon,
    title,
    desc,
    onClick,
}: {
    icon: string
    title: string
    desc: string
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-2 p-6 rounded-2xl text-center transition-all hover:scale-105"
            style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                minWidth: 140,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
            <span className="text-3xl">{icon}</span>
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {title}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {desc}
            </span>
        </button>
    )
}

// ─── Active round ─────────────────────────────────────────────────────────────

function GameRound({
    session,
    myAnswer,
    durationMs,
    onSubmitAnswer,
}: {
    session: GameSession
    myAnswer: string | null
    durationMs: number
    onSubmitAnswer: (videoId: string) => void
}) {
    const totalSeconds = durationMs / 1000
    const [timeLeft, setTimeLeft] = useState(totalSeconds)

    useEffect(() => {
        setTimeLeft(totalSeconds)
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0.1) {
                    clearInterval(interval)
                    return 0
                }
                return prev - 0.1
            })
        }, 100)
        return () => clearInterval(interval)
    }, [session.currentRound, totalSeconds])

    const progress = (timeLeft / totalSeconds) * 100
    const isUrgent = timeLeft < 10

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Round {session.currentRound} / {session.totalRounds}
                </span>
                <div className="flex items-center gap-2">
                    <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: isUrgent ? '#f87171' : 'var(--accent-light)' }}
                    >
                        {Math.ceil(timeLeft)}s
                    </span>
                </div>
            </div>

            {/* Timer bar */}
            <div
                className="h-1.5 rounded-full overflow-hidden flex-shrink-0"
                style={{ backgroundColor: 'var(--bg-overlay)' }}
            >
                <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{
                        width: `${progress}%`,
                        backgroundColor: isUrgent ? '#f87171' : 'var(--accent)',
                    }}
                />
            </div>

            {/* Music indicator */}
            <div className="flex items-center justify-center flex-shrink-0 py-2">
                <div className="flex items-end gap-1" style={{ height: 32 }}>
                    {[0.6, 1.0, 0.75, 0.9, 0.5, 0.8, 0.65].map((h, i) => (
                        <div
                            key={i}
                            className="w-1.5 rounded-full"
                            style={{
                                height: `${h * 100}%`,
                                backgroundColor: 'var(--accent)',
                                animation: `bounce ${0.4 + i * 0.07}s ease-in-out infinite alternate`,
                            }}
                        />
                    ))}
                </div>
                <span className="ml-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    🎧 Listen carefully…
                </span>
            </div>

            {/* Option cards */}
            <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden">
                {session.options.map((track) => (
                    <OptionCard
                        key={track.videoId}
                        track={track}
                        selected={myAnswer === track.videoId}
                        disabled={!!myAnswer}
                        onClick={() => onSubmitAnswer(track.videoId)}
                    />
                ))}
            </div>
        </div>
    )
}

function OptionCard({
    track,
    selected,
    disabled,
    onClick,
}: {
    track: GameTrack
    selected: boolean
    disabled: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex flex-col rounded-xl overflow-hidden transition-all text-left"
            style={{
                border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                backgroundColor: selected ? 'var(--accent-bg)' : 'var(--bg-card)',
                opacity: disabled && !selected ? 0.55 : 1,
                transform: selected ? 'scale(1.02)' : undefined,
                boxShadow: selected ? '0 0 0 3px var(--accent-ring)' : undefined,
            }}
        >
            {/* Cover image */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 */ }}>
                {track.thumbnailUrl ? (
                    <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div
                        className="absolute inset-0 flex items-center justify-center text-4xl"
                        style={{ backgroundColor: 'var(--bg-overlay)' }}
                    >
                        🎵
                    </div>
                )}
                {selected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="text-white text-2xl font-bold">✓</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-2.5">
                <p
                    className="text-sm font-semibold leading-tight line-clamp-2"
                    style={{ color: selected ? 'var(--accent-light)' : 'var(--text-primary)' }}
                >
                    {track.title}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {track.artist}
                </p>
            </div>
        </button>
    )
}

// ─── Round result ─────────────────────────────────────────────────────────────

function RoundResult({
    session,
    roundResult,
    myAnswer,
    currentUsername,
}: {
    session: GameSession
    roundResult: { correctVideoId: string; answers: Record<string, string>; scores: Record<string, number> }
    myAnswer: string | null
    currentUsername: string
}) {
    const correctTrack = session.options.find((o) => o.videoId === roundResult.correctVideoId)
    const iGotIt = myAnswer === roundResult.correctVideoId

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="text-center flex-shrink-0">
                <div className="text-3xl mb-1">{iGotIt ? '🎉' : '😔'}</div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {iGotIt ? 'Correct!' : 'The answer was…'}
                </h3>
            </div>

            {/* Correct track card */}
            {correctTrack && (
                <div
                    className="flex gap-3 p-3 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: 'var(--bg-card)', border: '2px solid var(--accent)' }}
                >
                    {correctTrack.thumbnailUrl && (
                        <img
                            src={correctTrack.thumbnailUrl}
                            alt={correctTrack.title}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                    )}
                    <div className="min-w-0">
                        <p className="font-bold text-sm leading-tight" style={{ color: 'var(--accent-light)' }}>
                            {correctTrack.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {correctTrack.artist}
                        </p>
                    </div>
                </div>
            )}

            {/* Player answers + scores */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
                {Object.entries(roundResult.scores)
                    .sort(([, a], [, b]) => b - a)
                    .map(([username, score]) => {
                        const answer = roundResult.answers[username]
                        const correct = answer === roundResult.correctVideoId
                        const isMe = username === currentUsername
                        return (
                            <div
                                key={username}
                                className="flex items-center justify-between px-3 py-2 rounded-lg"
                                style={{
                                    backgroundColor: isMe ? 'var(--accent-bg)' : 'var(--bg-card)',
                                    border: `1px solid ${isMe ? 'var(--accent-border)' : 'var(--border)'}`,
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">{correct ? '✅' : '❌'}</span>
                                    <span
                                        className="text-sm font-medium"
                                        style={{ color: isMe ? 'var(--accent-light)' : 'var(--text-primary)' }}
                                    >
                                        {username}
                                        {isMe && ' (you)'}
                                    </span>
                                </div>
                                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                    {score} pts
                                </span>
                            </div>
                        )
                    })}
            </div>

            <p className="text-center text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                Next round starting soon…
            </p>
        </div>
    )
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

function GameScoreboard({
    session,
    currentUsername,
    onLeave,
}: {
    session: GameSession
    currentUsername: string
    onLeave: () => void
}) {
    const sorted = Object.entries(session.scores).sort(([, a], [, b]) => b - a)
    const medals = ['🥇', '🥈', '🥉']

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="text-center flex-shrink-0">
                <div className="text-4xl mb-2">🏆</div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Game Over!
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Final scores after {session.totalRounds} rounds
                </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                {sorted.map(([username, score], i) => {
                    const isMe = username === currentUsername
                    return (
                        <div
                            key={username}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl"
                            style={{
                                backgroundColor: i === 0 ? 'var(--accent-bg)' : isMe ? 'var(--bg-overlay)' : 'var(--bg-card)',
                                border: `1px solid ${i === 0 ? 'var(--accent-border)' : 'var(--border)'}`,
                            }}
                        >
                            <span className="text-xl w-7 text-center">{medals[i] ?? `${i + 1}.`}</span>
                            <span
                                className="flex-1 font-medium text-sm"
                                style={{ color: i === 0 ? 'var(--accent-light)' : 'var(--text-primary)' }}
                            >
                                {username}
                                {isMe && ' (you)'}
                            </span>
                            <span
                                className="font-bold tabular-nums"
                                style={{ color: i === 0 ? 'var(--accent-light)' : 'var(--text-primary)' }}
                            >
                                {score} pts
                            </span>
                        </div>
                    )
                })}
            </div>

            <button
                onClick={onLeave}
                className="w-full py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
                style={{
                    backgroundImage: 'linear-gradient(to right, var(--accent-light), var(--accent))',
                    color: 'var(--text-on-accent)',
                }}
            >
                Close
            </button>
        </div>
    )
}

// ─── GamePanel (root) ─────────────────────────────────────────────────────────

export function GamePanel({
    session,
    myAnswer,
    roundResult,
    currentRound,
    currentUsername,
    game,
}: GamePanelProps) {
    const isHost = session.host === currentUsername
    const ytContainerRef = useRef<HTMLDivElement>(null)

    useYouTubePlayer(ytContainerRef, currentRound ?? null)

    const isLobby = ['lobby', 'mode_select', 'artist_select', 'genre_select'].includes(session.status)

    return (
        <div
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--bg-base) 90%, transparent)' }}
        >
            {/* Hidden YouTube player — audio plays, no video visible */}
            <div
                ref={ytContainerRef}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
            />

            {/* Game card */}
            <div
                className="relative flex flex-col rounded-2xl overflow-hidden"
                style={{
                    width: 'min(640px, calc(100% - 3rem))',
                    height: 'min(520px, calc(100% - 3rem))',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
                }}
            >
                {/* Top bar */}
                <div
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                    style={{
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-card)',
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-base">🎵</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            Guess The Song
                        </span>
                        {session.status === 'round_active' && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                    backgroundColor: 'var(--accent-bg)',
                                    color: 'var(--accent-light)',
                                    border: '1px solid var(--accent-border)',
                                }}
                            >
                                Round {session.currentRound}/{session.totalRounds}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={game.leaveGame}
                        className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-overlay)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                    >
                        Leave
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden p-4">
                    {isLobby && (
                        <GameLobby session={session} isHost={isHost} game={game} />
                    )}

                    {session.status === 'round_active' && currentRound && (
                        <GameRound
                            session={session}
                            myAnswer={myAnswer}
                            durationMs={currentRound.durationMs}
                            onSubmitAnswer={game.submitAnswer}
                        />
                    )}

                    {session.status === 'round_result' && roundResult && (
                        <RoundResult
                            session={session}
                            roundResult={roundResult}
                            myAnswer={myAnswer}
                            currentUsername={currentUsername}
                        />
                    )}

                    {session.status === 'ended' && (
                        <GameScoreboard
                            session={session}
                            currentUsername={currentUsername}
                            onLeave={game.leaveGame}
                        />
                    )}
                </div>
            </div>

            {/* Bounce animation keyframes */}
            <style>{`
                @keyframes bounce {
                    from { transform: scaleY(0.4); }
                    to   { transform: scaleY(1.0); }
                }
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}</style>
        </div>
    )
}
