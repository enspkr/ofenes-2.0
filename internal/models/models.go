// Package models defines the shared data structures ("the contract")
// used across handlers, WebSocket logic, and eventually mirrored
// as TypeScript interfaces on the frontend.
package models

import (
	"encoding/json"
	"time"
)

// --- User ---

// User represents a registered participant.
type User struct {
	ID           string          `json:"id"`
	Username     string          `json:"username"`
	PasswordHash string          `json:"-"` // Never serialized to JSON
	Role         string          `json:"role"`
	DisplayName  *string         `json:"displayName,omitempty"`
	AvatarURL    *string         `json:"avatarUrl,omitempty"`
	Status       string          `json:"status"`
	Bio          *string         `json:"bio,omitempty"`
	Preferences  json.RawMessage `json:"preferences,omitempty"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

// UserRole constants -- use these instead of raw strings.
const (
	RoleAdmin  = "admin"
	RoleMember = "member"
	RoleViewer = "viewer"
)

// UserStatus constants.
const (
	StatusOnline  = "online"
	StatusOffline = "offline"
	StatusAway    = "away"
	StatusBusy    = "busy"
)

// --- Message (WebSocket envelope) ---

// Message is a chat or system event sent through WebSocket.
type Message struct {
	Type      string    `json:"type"`
	Sender    string    `json:"sender"`
	Payload   string    `json:"payload"`
	Timestamp time.Time `json:"timestamp"`
}

// MessageType constants for WebSocket routing.
const (
	MsgTypeChat      = "chat"
	MsgTypeSystem    = "system"
	MsgTypeVideoSync = "video_sync"
	MsgTypeWebRTC    = "webrtc"
	MsgTypeUserList  = "user_list"
	MsgTypeAdmin     = "admin"
)

// --- ChatMessage (persisted) ---

// ChatMessage is a persisted chat message stored in the database.
type ChatMessage struct {
	ID        string          `json:"id"`
	RoomID    string          `json:"roomId"`
	SenderID  string          `json:"senderId"`
	Sender    string          `json:"sender"` // username, joined from users table
	Type      string          `json:"type"`
	Content   string          `json:"content"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
}

// --- Video ---

// VideoState tracks the synchronized video playback position.
type VideoState struct {
	URL       string  `json:"url"`
	Playing   bool    `json:"playing"`
	Timestamp float64 `json:"timestamp"` // seconds
}

// --- Room ---

// Room represents a collaborative session that users can join.
type Room struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	Type        string     `json:"type"`
	CreatedBy   string     `json:"createdBy"`
	IsActive    bool       `json:"isActive"`
	VideoState  VideoState `json:"videoState"`
	MaxMembers  int        `json:"maxMembers"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// RoomType constants.
const (
	RoomTypePublic  = "public"
	RoomTypePrivate = "private"
	RoomTypeDirect  = "direct"
)

// RoomMember represents a user's membership in a room.
type RoomMember struct {
	RoomID   string    `json:"roomId"`
	UserID   string    `json:"userId"`
	Username string    `json:"username"` // joined from users table
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joinedAt"`
}

// RoomRole constants (per-room roles, distinct from global user roles).
const (
	RoomRoleOwner     = "owner"
	RoomRoleModerator = "moderator"
	RoomRoleMember    = "member"
	RoomRoleViewer    = "viewer"
)

// --- Media Sessions ---

// MediaSession tracks a video call, screen share, or audio call session.
type MediaSession struct {
	ID        string     `json:"id"`
	RoomID    string     `json:"roomId"`
	Type      string     `json:"type"`
	StartedBy string     `json:"startedBy"`
	StartedAt time.Time  `json:"startedAt"`
	EndedAt   *time.Time `json:"endedAt,omitempty"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// MediaSessionType constants.
const (
	MediaTypeVideoCall   = "video_call"
	MediaTypeScreenShare = "screen_share"
	MediaTypeAudioCall   = "audio_call"
)

// MediaSessionParticipant tracks who joined and left a media session.
type MediaSessionParticipant struct {
	SessionID string     `json:"sessionId"`
	UserID    string     `json:"userId"`
	Username  string     `json:"username"` // joined from users table
	JoinedAt  time.Time  `json:"joinedAt"`
	LeftAt    *time.Time `json:"leftAt,omitempty"`
}

// --- Shared Files ---

// SharedFile stores metadata about a file shared in a room.
type SharedFile struct {
	ID          string    `json:"id"`
	RoomID      string    `json:"roomId"`
	UploadedBy  string    `json:"uploadedBy"`
	FileName    string    `json:"fileName"`
	FileSize    int64     `json:"fileSize"`
	MimeType    string    `json:"mimeType"`
	StoragePath string    `json:"-"` // Internal, not exposed to clients
	MessageID   *string   `json:"messageId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// --- Auth DTOs ---
// Data Transfer Objects for request/response serialization.

// RegisterRequest is the expected payload for POST /api/register.
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginRequest is the expected payload for POST /api/login.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AuthResponse is returned on successful login/register.
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// --- Room DTOs ---

// CreateRoomRequest is the expected payload for POST /api/rooms.
type CreateRoomRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Type        string  `json:"type"`
	MaxMembers  int     `json:"maxMembers,omitempty"`
}

// UpdateRoomRequest is the expected payload for PUT /api/rooms/{id}.
type UpdateRoomRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	MaxMembers  *int    `json:"maxMembers,omitempty"`
}

// --- Profile DTOs ---

// UpdateProfileRequest is the expected payload for PUT /api/me/profile.
type UpdateProfileRequest struct {
	DisplayName *string `json:"displayName"`
	AvatarURL   *string `json:"avatarUrl"`
	Bio         *string `json:"bio"`
}
