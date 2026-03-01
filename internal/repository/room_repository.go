package repository

import (
	"context"

	"ofenes/internal/models"
)

// RoomRepository defines the contract for room data access.
type RoomRepository interface {
	// Create stores a new room.
	Create(ctx context.Context, room *models.Room) error

	// GetByID retrieves a room by ID. Returns ErrNotFound if missing.
	GetByID(ctx context.Context, id string) (*models.Room, error)

	// List returns rooms the given user is a member of.
	List(ctx context.Context, userID string, limit, offset int) ([]*models.Room, error)

	// ListPublic returns all active public rooms.
	ListPublic(ctx context.Context, limit, offset int) ([]*models.Room, error)

	// Update updates a room's name, description, or max members.
	Update(ctx context.Context, room *models.Room) error

	// Delete soft-deletes a room (sets is_active = false).
	Delete(ctx context.Context, id string) error

	// AddMember adds a user to a room with the given role.
	AddMember(ctx context.Context, roomID, userID, role string) error

	// RemoveMember removes a user from a room.
	RemoveMember(ctx context.Context, roomID, userID string) error

	// GetMembers returns all members of a room.
	GetMembers(ctx context.Context, roomID string) ([]*models.RoomMember, error)

	// GetMemberRole returns the role of a user in a room. Returns ErrNotFound if not a member.
	GetMemberRole(ctx context.Context, roomID, userID string) (string, error)

	// UpdateVideoState updates the synchronized video state for a room.
	UpdateVideoState(ctx context.Context, roomID string, state models.VideoState) error
}
