package repository

import (
	"context"
	"time"

	"ofenes/internal/models"
)

// MessageRepository defines the contract for chat message data access.
type MessageRepository interface {
	// Create stores a new chat message.
	Create(ctx context.Context, msg *models.ChatMessage) error

	// GetByRoom returns messages for a room, paginated by cursor (before timestamp).
	// Results are ordered newest-first (DESC).
	GetByRoom(ctx context.Context, roomID string, before time.Time, limit int) ([]*models.ChatMessage, error)

	// GetByID retrieves a single message by ID. Returns ErrNotFound if missing.
	GetByID(ctx context.Context, id string) (*models.ChatMessage, error)
}
