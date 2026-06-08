package repository

import (
	"context"
	"errors"

	"ofenes/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgSharedFileRepo implements SharedFileRepository against PostgreSQL.
type PgSharedFileRepo struct {
	pool *pgxpool.Pool
}

// NewPgSharedFileRepo creates a new PostgreSQL-backed shared file repository.
func NewPgSharedFileRepo(pool *pgxpool.Pool) *PgSharedFileRepo {
	return &PgSharedFileRepo{pool: pool}
}

// Create inserts file metadata.
func (r *PgSharedFileRepo) Create(ctx context.Context, file *models.SharedFile) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO shared_files (id, room_id, uploaded_by, file_name, file_size, mime_type, storage_path, message_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, file.ID, file.RoomID, file.UploadedBy, file.FileName, file.FileSize,
		file.MimeType, file.StoragePath, file.MessageID, file.CreatedAt)
	return err
}

// GetByRoom returns files shared in a room, newest first.
func (r *PgSharedFileRepo) GetByRoom(ctx context.Context, roomID string, limit, offset int) ([]*models.SharedFile, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, room_id, uploaded_by, file_name, file_size, mime_type, storage_path, message_id, created_at
		FROM shared_files
		WHERE room_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, roomID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []*models.SharedFile
	for rows.Next() {
		var f models.SharedFile
		if err := rows.Scan(
			&f.ID, &f.RoomID, &f.UploadedBy, &f.FileName, &f.FileSize,
			&f.MimeType, &f.StoragePath, &f.MessageID, &f.CreatedAt,
		); err != nil {
			return nil, err
		}
		files = append(files, &f)
	}
	return files, rows.Err()
}

// GetByID retrieves a file by ID.
func (r *PgSharedFileRepo) GetByID(ctx context.Context, id string) (*models.SharedFile, error) {
	var f models.SharedFile
	err := r.pool.QueryRow(ctx, `
		SELECT id, room_id, uploaded_by, file_name, file_size, mime_type, storage_path, message_id, created_at
		FROM shared_files WHERE id = $1
	`, id).Scan(
		&f.ID, &f.RoomID, &f.UploadedBy, &f.FileName, &f.FileSize,
		&f.MimeType, &f.StoragePath, &f.MessageID, &f.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &f, nil
}

// Delete removes a shared file record.
func (r *PgSharedFileRepo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM shared_files WHERE id = $1
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
