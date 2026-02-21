// Package models defines the shared data structures ("the contract")
// used across handlers, WebSocket logic, and eventually mirrored
// as TypeScript interfaces on the frontend.
package models

import "time"

// User represents a connected participant.
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"` // "admin" | "member" | "viewer"
}

// Message is a chat or system event sent through WebSocket.
type Message struct {
	Type      string    `json:"type"`      // "chat" | "system" | "video_sync" | "admin"
	Sender    string    `json:"sender"`    // User ID
	Payload   string    `json:"payload"`   // The actual content
	Timestamp time.Time `json:"timestamp"`
}

// VideoState tracks the synchronized video playback position.
type VideoState struct {
	URL       string  `json:"url"`
	Playing   bool    `json:"playing"`
	Timestamp float64 `json:"timestamp"` // seconds
}
