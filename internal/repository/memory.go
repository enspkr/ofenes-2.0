package repository

import (
	"context"
	"errors"
	"sync"

	"ofenes/internal/models"
)

// Common errors returned by repository implementations.
var (
	ErrNotFound      = errors.New("repository: not found")
	ErrAlreadyExists = errors.New("repository: already exists")
)

// MemoryUserRepo is an in-memory implementation of UserRepository.
// Safe for concurrent access via sync.RWMutex.
//
// This is suitable for development and testing. For production,
// implement UserRepository against PostgreSQL or another persistent store.
type MemoryUserRepo struct {
	mu    sync.RWMutex
	users map[string]*models.User // keyed by user ID
}

// NewMemoryUserRepo creates an empty in-memory user store.
func NewMemoryUserRepo() *MemoryUserRepo {
	return &MemoryUserRepo{
		users: make(map[string]*models.User),
	}
}

// Create stores a new user. Returns ErrAlreadyExists if the username is taken.
func (r *MemoryUserRepo) Create(_ context.Context, user *models.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check for duplicate username
	for _, existing := range r.users {
		if existing.Username == user.Username {
			return ErrAlreadyExists
		}
	}

	r.users[user.ID] = user
	return nil
}

// GetByID retrieves a user by ID. Returns ErrNotFound if missing.
func (r *MemoryUserRepo) GetByID(_ context.Context, id string) (*models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, ok := r.users[id]
	if !ok {
		return nil, ErrNotFound
	}
	return user, nil
}

// GetByUsername retrieves a user by username. Returns ErrNotFound if missing.
func (r *MemoryUserRepo) GetByUsername(_ context.Context, username string) (*models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, user := range r.users {
		if user.Username == username {
			return user, nil
		}
	}
	return nil, ErrNotFound
}
