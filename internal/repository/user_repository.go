// Package repository defines interfaces for data access.
//
// Using interfaces decouples handlers from the storage implementation.
// Today we use an in-memory store; tomorrow we swap in PostgreSQL
// by implementing the same interface — zero handler changes.
package repository

import (
	"context"

	"ofenes/internal/models"
)

// UserRepository defines the contract for user data access.
// Any storage backend (memory, PostgreSQL, SQLite) must satisfy this.
type UserRepository interface {
	// Create stores a new user. Returns an error if the username already exists.
	Create(ctx context.Context, user *models.User) error

	// GetByID retrieves a user by their unique ID.
	// Returns ErrNotFound if the user does not exist.
	GetByID(ctx context.Context, id string) (*models.User, error)

	// GetByUsername retrieves a user by their username.
	// Returns ErrNotFound if the user does not exist.
	GetByUsername(ctx context.Context, username string) (*models.User, error)
}
