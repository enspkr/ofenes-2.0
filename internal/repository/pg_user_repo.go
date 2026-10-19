package repository

import (
	"context"
	"encoding/json"
	"errors"

	"ofenes/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgUserRepo implements UserRepository against PostgreSQL.
type PgUserRepo struct {
	pool *pgxpool.Pool
}

// NewPgUserRepo creates a new PostgreSQL-backed user repository.
func NewPgUserRepo(pool *pgxpool.Pool) *PgUserRepo {
	return &PgUserRepo{pool: pool}
}

// Create inserts a new user. Returns ErrAlreadyExists on unique constraint violation.
func (r *PgUserRepo) Create(ctx context.Context, user *models.User) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO users (id, username, password_hash, role, display_name, avatar_url, status, bio, preferences, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, user.ID, user.Username, user.PasswordHash, user.Role,
		user.DisplayName, user.AvatarURL, user.Status, user.Bio,
		user.Preferences, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrAlreadyExists
		}
		return err
	}
	return nil
}

// GetByID retrieves a user by ID. Returns ErrNotFound if missing.
func (r *PgUserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	return r.scanUser(r.pool.QueryRow(ctx, `
		SELECT id, username, password_hash, role, display_name, avatar_url, status, bio, preferences, created_at, updated_at
		FROM users WHERE id = $1
	`, id))
}

// GetByUsername retrieves a user by username. Returns ErrNotFound if missing.
func (r *PgUserRepo) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	return r.scanUser(r.pool.QueryRow(ctx, `
		SELECT id, username, password_hash, role, display_name, avatar_url, status, bio, preferences, created_at, updated_at
		FROM users WHERE username = $1
	`, username))
}

// Update updates a user's profile fields.
func (r *PgUserRepo) Update(ctx context.Context, user *models.User) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE users SET display_name = $2, avatar_url = $3, bio = $4
		WHERE id = $1
	`, user.ID, user.DisplayName, user.AvatarURL, user.Bio)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UpdateStatus sets the user's online status.
func (r *PgUserRepo) UpdateStatus(ctx context.Context, userID string, status string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE users SET status = $2 WHERE id = $1
	`, userID, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UpdatePreferences replaces the user's preferences JSON.
func (r *PgUserRepo) UpdatePreferences(ctx context.Context, userID string, prefs json.RawMessage) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE users SET preferences = $2 WHERE id = $1
	`, userID, prefs)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// List returns a paginated list of users.
func (r *PgUserRepo) List(ctx context.Context, limit, offset int) ([]*models.User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, username, password_hash, role, display_name, avatar_url, status, bio, preferences, created_at, updated_at
		FROM users ORDER BY created_at ASC LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		u, err := r.scanUserFromRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// scanUser scans a single user row.
func (r *PgUserRepo) scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(
		&u.ID, &u.Username, &u.PasswordHash, &u.Role,
		&u.DisplayName, &u.AvatarURL, &u.Status, &u.Bio,
		&u.Preferences, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// scanUserFromRow scans a user from pgx.Rows (used in List).
func (r *PgUserRepo) scanUserFromRow(rows pgx.Rows) (*models.User, error) {
	var u models.User
	err := rows.Scan(
		&u.ID, &u.Username, &u.PasswordHash, &u.Role,
		&u.DisplayName, &u.AvatarURL, &u.Status, &u.Bio,
		&u.Preferences, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
