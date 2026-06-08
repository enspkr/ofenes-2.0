package repository

import (
	"context"
	"encoding/json"
	"errors"

	"ofenes/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgRoomRepo implements RoomRepository against PostgreSQL.
type PgRoomRepo struct {
	pool *pgxpool.Pool
}

// NewPgRoomRepo creates a new PostgreSQL-backed room repository.
func NewPgRoomRepo(pool *pgxpool.Pool) *PgRoomRepo {
	return &PgRoomRepo{pool: pool}
}

// Create inserts a new room.
func (r *PgRoomRepo) Create(ctx context.Context, room *models.Room) error {
	videoStateJSON, err := json.Marshal(room.VideoState)
	if err != nil {
		return err
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO rooms (id, name, description, type, created_by, is_active, video_state, max_members, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, room.ID, room.Name, room.Description, room.Type,
		room.CreatedBy, room.IsActive, videoStateJSON,
		room.MaxMembers, room.CreatedAt, room.UpdatedAt)
	return err
}

// GetByID retrieves a room by ID.
func (r *PgRoomRepo) GetByID(ctx context.Context, id string) (*models.Room, error) {
	var room models.Room
	var videoStateJSON []byte

	err := r.pool.QueryRow(ctx, `
		SELECT id, name, description, type, created_by, is_active, video_state, max_members, created_at, updated_at
		FROM rooms WHERE id = $1
	`, id).Scan(
		&room.ID, &room.Name, &room.Description, &room.Type,
		&room.CreatedBy, &room.IsActive, &videoStateJSON,
		&room.MaxMembers, &room.CreatedAt, &room.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if err := json.Unmarshal(videoStateJSON, &room.VideoState); err != nil {
		return nil, err
	}
	return &room, nil
}

// List returns rooms the user is a member of.
func (r *PgRoomRepo) List(ctx context.Context, userID string, limit, offset int) ([]*models.Room, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.name, r.description, r.type, r.created_by, r.is_active, r.video_state, r.max_members, r.created_at, r.updated_at
		FROM rooms r
		JOIN room_members rm ON rm.room_id = r.id
		WHERE rm.user_id = $1 AND r.is_active = true
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanRooms(rows)
}

// ListPublic returns all active public rooms.
func (r *PgRoomRepo) ListPublic(ctx context.Context, limit, offset int) ([]*models.Room, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, description, type, created_by, is_active, video_state, max_members, created_at, updated_at
		FROM rooms
		WHERE type = 'public' AND is_active = true
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanRooms(rows)
}

// Update updates a room's mutable fields.
func (r *PgRoomRepo) Update(ctx context.Context, room *models.Room) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE rooms SET name = $2, description = $3, max_members = $4
		WHERE id = $1
	`, room.ID, room.Name, room.Description, room.MaxMembers)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Delete soft-deletes a room.
func (r *PgRoomRepo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE rooms SET is_active = false WHERE id = $1
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AddMember adds a user to a room.
func (r *PgRoomRepo) AddMember(ctx context.Context, roomID, userID, role string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO room_members (room_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (room_id, user_id) DO NOTHING
	`, roomID, userID, role)
	return err
}

// RemoveMember removes a user from a room.
func (r *PgRoomRepo) RemoveMember(ctx context.Context, roomID, userID string) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM room_members WHERE room_id = $1 AND user_id = $2
	`, roomID, userID)
	return err
}

// GetMembers returns all members of a room with their usernames.
func (r *PgRoomRepo) GetMembers(ctx context.Context, roomID string) ([]*models.RoomMember, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT rm.room_id, rm.user_id, u.username, rm.role, rm.joined_at
		FROM room_members rm
		JOIN users u ON u.id = rm.user_id
		WHERE rm.room_id = $1
		ORDER BY rm.joined_at ASC
	`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []*models.RoomMember
	for rows.Next() {
		var m models.RoomMember
		if err := rows.Scan(&m.RoomID, &m.UserID, &m.Username, &m.Role, &m.JoinedAt); err != nil {
			return nil, err
		}
		members = append(members, &m)
	}
	return members, rows.Err()
}

// GetMemberRole returns the role of a user in a room.
func (r *PgRoomRepo) GetMemberRole(ctx context.Context, roomID, userID string) (string, error) {
	var role string
	err := r.pool.QueryRow(ctx, `
		SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2
	`, roomID, userID).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return role, nil
}

// UpdateVideoState updates the video sync state for a room.
func (r *PgRoomRepo) UpdateVideoState(ctx context.Context, roomID string, state models.VideoState) error {
	videoJSON, err := json.Marshal(state)
	if err != nil {
		return err
	}

	tag, err := r.pool.Exec(ctx, `
		UPDATE rooms SET video_state = $2 WHERE id = $1
	`, roomID, videoJSON)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// scanRooms scans multiple room rows from a query result.
func (r *PgRoomRepo) scanRooms(rows pgx.Rows) ([]*models.Room, error) {
	var rooms []*models.Room
	for rows.Next() {
		var room models.Room
		var videoStateJSON []byte

		if err := rows.Scan(
			&room.ID, &room.Name, &room.Description, &room.Type,
			&room.CreatedBy, &room.IsActive, &videoStateJSON,
			&room.MaxMembers, &room.CreatedAt, &room.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if err := json.Unmarshal(videoStateJSON, &room.VideoState); err != nil {
			return nil, err
		}
		rooms = append(rooms, &room)
	}
	return rooms, rows.Err()
}
