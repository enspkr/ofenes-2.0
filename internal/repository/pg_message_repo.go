package repository

import (
	"context"
	"errors"
	"time"

	"ofenes/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgMessageRepo implements MessageRepository against PostgreSQL.
type PgMessageRepo struct {
	pool *pgxpool.Pool
}

// NewPgMessageRepo creates a new PostgreSQL-backed message repository.
func NewPgMessageRepo(pool *pgxpool.Pool) *PgMessageRepo {
	return &PgMessageRepo{pool: pool}
}

// Create inserts a new chat message.
func (r *PgMessageRepo) Create(ctx context.Context, msg *models.ChatMessage) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO messages (id, room_id, sender_id, type, content, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, msg.ID, msg.RoomID, msg.SenderID, msg.Type, msg.Content, msg.Metadata, msg.CreatedAt)
	return err
}

// GetByRoom returns messages for a room before a given timestamp, newest first.
func (r *PgMessageRepo) GetByRoom(ctx context.Context, roomID string, before time.Time, limit int) ([]*models.ChatMessage, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT m.id, m.room_id, m.sender_id, u.username, m.type, m.content, m.metadata, m.created_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.room_id = $1 AND m.created_at < $2
		ORDER BY m.created_at DESC
		LIMIT $3
	`, roomID, before, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*models.ChatMessage
	for rows.Next() {
		var msg models.ChatMessage
		if err := rows.Scan(
			&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Sender,
			&msg.Type, &msg.Content, &msg.Metadata, &msg.CreatedAt,
		); err != nil {
			return nil, err
		}
		messages = append(messages, &msg)
	}
	return messages, rows.Err()
}

// GetByID retrieves a single message by ID.
func (r *PgMessageRepo) GetByID(ctx context.Context, id string) (*models.ChatMessage, error) {
	var msg models.ChatMessage
	err := r.pool.QueryRow(ctx, `
		SELECT m.id, m.room_id, m.sender_id, u.username, m.type, m.content, m.metadata, m.created_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.id = $1
	`, id).Scan(
		&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Sender,
		&msg.Type, &msg.Content, &msg.Metadata, &msg.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &msg, nil
}
