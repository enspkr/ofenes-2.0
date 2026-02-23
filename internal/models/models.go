// Package models defines the shared data structures ("the contract")
// used across handlers, WebSocket logic, and eventually mirrored
// as TypeScript interfaces on the frontend.
package models

import "time"

// --- User ---

// User represents a registered participant.
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never serialized to JSON
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
}

// UserRole constants — use these instead of raw strings.
const (
	RoleAdmin  = "admin"
	RoleMember = "member"
	RoleViewer = "viewer"
)

// --- Message ---

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
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	OwnerID    string     `json:"ownerId"`
	VideoState VideoState `json:"videoState"`
	CreatedAt  time.Time  `json:"createdAt"`
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
