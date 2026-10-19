package repository

import (
	"context"

	"ofenes/internal/models"
)

// MediaSessionRepository defines the contract for media session data access.
type MediaSessionRepository interface {
	// Create stores a new media session.
	Create(ctx context.Context, session *models.MediaSession) error

	// End marks a media session as ended (sets ended_at to now).
	End(ctx context.Context, sessionID string) error

	// GetActive returns currently active sessions in a room (ended_at IS NULL).
	GetActive(ctx context.Context, roomID string) ([]*models.MediaSession, error)

	// GetByRoom returns past sessions for a room, newest first.
	GetByRoom(ctx context.Context, roomID string, limit, offset int) ([]*models.MediaSession, error)

	// AddParticipant records a user joining a media session.
	AddParticipant(ctx context.Context, sessionID, userID string) error

	// RemoveParticipant records a user leaving a media session.
	RemoveParticipant(ctx context.Context, sessionID, userID string) error
}

// SharedFileRepository defines the contract for shared file metadata access.
type SharedFileRepository interface {
	// Create stores metadata for a shared file.
	Create(ctx context.Context, file *models.SharedFile) error

	// GetByRoom returns files shared in a room, newest first.
	GetByRoom(ctx context.Context, roomID string, limit, offset int) ([]*models.SharedFile, error)

	// GetByID retrieves a file by ID. Returns ErrNotFound if missing.
	GetByID(ctx context.Context, id string) (*models.SharedFile, error)

	// Delete removes a shared file record.
	Delete(ctx context.Context, id string) error
}
