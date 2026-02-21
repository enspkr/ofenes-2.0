// Shared type definitions mirroring Go structs in internal/models/models.go.

export interface User {
    id: string
    username: string
    role: 'admin' | 'member' | 'viewer'
    createdAt: string
}

export interface Message {
    type: 'chat' | 'system' | 'video_sync' | 'admin'
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
