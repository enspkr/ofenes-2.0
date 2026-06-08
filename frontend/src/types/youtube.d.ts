// Minimal type declarations for the YouTube IFrame Player API.
// Loaded via <script src="https://www.youtube.com/iframe_api"> at runtime.

declare namespace YT {
    class Player {
        constructor(elementIdOrElement: string | HTMLElement, options: PlayerOptions)
        loadVideoById(options: { videoId: string; startSeconds?: number }): void
        stopVideo(): void
        destroy(): void
        getPlayerState(): number
    }

    interface PlayerOptions {
        videoId?: string
        width?: number | string
        height?: number | string
        playerVars?: {
            autoplay?: 0 | 1
            controls?: 0 | 1
            disablekb?: 0 | 1
            fs?: 0 | 1
            modestbranding?: 0 | 1
            rel?: 0 | 1
            [key: string]: string | number | undefined
        }
        events?: {
            onReady?: (event: PlayerEvent) => void
            onStateChange?: (event: OnStateChangeEvent) => void
            onError?: (event: PlayerEvent) => void
        }
    }

    interface PlayerEvent {
        target: Player
    }

    interface OnStateChangeEvent {
        target: Player
        data: number
    }

    const PlayerState: {
        UNSTARTED: -1
        ENDED: 0
        PLAYING: 1
        PAUSED: 2
        BUFFERING: 3
        CUED: 5
    }
}

interface Window {
    onYouTubeIframeAPIReady?: () => void
    YT?: typeof YT
}
