// Shared type definitions that mirror the Go models in internal/models/models.go.
// Keep these in sync with the backend structs.

export interface User {
    id: string
    username: string
    role: 'admin' | 'member' | 'viewer'
}

export interface Message {
    type: 'chat' | 'system' | 'video_sync' | 'admin'
    sender: string
    payload: string
    timestamp: string // ISO 8601
}

export interface VideoState {
    url: string
    playing: boolean
    timestamp: number // seconds
}
