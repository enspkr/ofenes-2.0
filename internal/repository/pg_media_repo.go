package repository

import (
	"context"

	"ofenes/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgMediaSessionRepo implements MediaSessionRepository against PostgreSQL.
type PgMediaSessionRepo struct {
	pool *pgxpool.Pool
}

// NewPgMediaSessionRepo creates a new PostgreSQL-backed media session repository.
func NewPgMediaSessionRepo(pool *pgxpool.Pool) *PgMediaSessionRepo {
	return &PgMediaSessionRepo{pool: pool}
}

// Create inserts a new media session.
func (r *PgMediaSessionRepo) Create(ctx context.Context, session *models.MediaSession) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO media_sessions (id, room_id, type, started_by, started_at, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, session.ID, session.RoomID, session.Type, session.StartedBy, session.StartedAt, session.Metadata)
	return err
}

// End marks a media session as ended.
func (r *PgMediaSessionRepo) End(ctx context.Context, sessionID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE media_sessions SET ended_at = now() WHERE id = $1 AND ended_at IS NULL
	`, sessionID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetActive returns currently active sessions in a room.
func (r *PgMediaSessionRepo) GetActive(ctx context.Context, roomID string) ([]*models.MediaSession, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, room_id, type, started_by, started_at, ended_at, metadata
		FROM media_sessions
		WHERE room_id = $1 AND ended_at IS NULL
		ORDER BY started_at DESC
	`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanSessions(rows)
}

// GetByRoom returns past sessions for a room.
func (r *PgMediaSessionRepo) GetByRoom(ctx context.Context, roomID string, limit, offset int) ([]*models.MediaSession, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, room_id, type, started_by, started_at, ended_at, metadata
		FROM media_sessions
		WHERE room_id = $1
		ORDER BY started_at DESC
		LIMIT $2 OFFSET $3
	`, roomID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return r.scanSessions(rows)
}

// AddParticipant records a user joining a media session.
func (r *PgMediaSessionRepo) AddParticipant(ctx context.Context, sessionID, userID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO media_session_participants (session_id, user_id)
		VALUES ($1, $2)
	`, sessionID, userID)
	return err
}

// RemoveParticipant records a user leaving a media session.
func (r *PgMediaSessionRepo) RemoveParticipant(ctx context.Context, sessionID, userID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE media_session_participants SET left_at = now()
		WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL
	`, sessionID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *PgMediaSessionRepo) scanSessions(rows pgx.Rows) ([]*models.MediaSession, error) {
	var sessions []*models.MediaSession
	for rows.Next() {
		var s models.MediaSession
		if err := rows.Scan(&s.ID, &s.RoomID, &s.Type, &s.StartedBy, &s.StartedAt, &s.EndedAt, &s.Metadata); err != nil {
			return nil, err
		}
		sessions = append(sessions, &s)
	}
	return sessions, rows.Err()
}
