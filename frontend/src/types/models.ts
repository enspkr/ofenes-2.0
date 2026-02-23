// Shared type definitions mirroring Go structs in internal/models/models.go.

export interface User {
    id: string
    username: string
    role: 'admin' | 'member' | 'viewer'
    createdAt: string
}

export interface Message {
    type: 'chat' | 'system' | 'video_sync' | 'webrtc' | 'user_list' | 'admin'
    sender: string
    payload: string
    timestamp: string
}

export interface VideoState {
    url: string
    playing: boolean
    timestamp: number
}

export interface Room {
    id: string
    name: string
    ownerId: string
    videoState: VideoState
    createdAt: string
}

// --- Auth DTOs ---

export interface RegisterRequest {
    username: string
    password: string
}

export interface LoginRequest {
    username: string
    password: string
}

export interface AuthResponse {
    token: string
    user: User
}

export interface ApiError {
    error: string
}

// --- Video Sync ---

export interface VideoSyncPayload {
    /** What triggered this sync event */
    event: 'play' | 'pause' | 'seek' | 'load'
    /** Video URL */
    url: string
    /** Is the video currently playing? */
    playing: boolean
    /** Playback position in seconds */
    timestamp: number
    /** Who triggered this event (to ignore own echoes) */
    triggeredBy: string
}
