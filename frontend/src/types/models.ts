// Shared type definitions mirroring Go structs in internal/models/models.go.

export interface User {
    id: string
    username: string
    role: 'admin' | 'member' | 'viewer'
    displayName?: string | null
    avatarUrl?: string | null
    status: 'online' | 'offline' | 'away' | 'busy'
    bio?: string | null
    preferences?: Record<string, unknown>
    createdAt: string
    updatedAt: string
}

export interface Message {
    type: 'chat' | 'system' | 'video_sync' | 'webrtc' | 'user_list' | 'admin'
    sender: string
    payload: string
    timestamp: string
}

export interface ChatMessage {
    id: string
    roomId: string
    senderId: string
    sender: string
    type: 'chat' | 'system' | 'video_sync' | 'admin'
    content: string
    metadata?: Record<string, unknown>
    createdAt: string
}

export interface VideoState {
    url: string
    playing: boolean
    timestamp: number
}

export interface Room {
    id: string
    name: string
    description?: string | null
    type: 'public' | 'private' | 'direct'
    createdBy: string
    isActive: boolean
    videoState: VideoState
    maxMembers: number
    createdAt: string
    updatedAt: string
}

export interface RoomMember {
    roomId: string
    userId: string
    username: string
    role: 'owner' | 'moderator' | 'member' | 'viewer'
    joinedAt: string
}

export interface MediaSession {
    id: string
    roomId: string
    type: 'video_call' | 'screen_share' | 'audio_call'
    startedBy: string
    startedAt: string
    endedAt?: string | null
    metadata?: Record<string, unknown>
}

export interface MediaSessionParticipant {
    sessionId: string
    userId: string
    username: string
    joinedAt: string
    leftAt?: string | null
}

export interface SharedFile {
    id: string
    roomId: string
    uploadedBy: string
    fileName: string
    fileSize: number
    mimeType: string
    messageId?: string | null
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

// --- Room DTOs ---

export interface CreateRoomRequest {
    name: string
    description?: string
    type: 'public' | 'private' | 'direct'
    maxMembers?: number
}

export interface UpdateRoomRequest {
    name?: string
    description?: string
    maxMembers?: number
}

export interface UpdateProfileRequest {
    displayName?: string | null
    avatarUrl?: string | null
    bio?: string | null
}

// --- Video Sync ---

export interface VideoSyncPayload {
    event: 'play' | 'pause' | 'seek' | 'load'
    url: string
    playing: boolean
    timestamp: number
    triggeredBy: string
}
