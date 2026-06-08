// Package app provides the application dependency container.
//
// The App struct is the single "root" that holds all shared dependencies
// (config, repositories, services). It is created once in main.go and
// passed to handlers and middleware via dependency injection.
//
// Why this pattern?
//   - No global state — every dependency is explicit.
//   - Easy to test — mock any field via an interface.
//   - Easy to extend — add a new service? Add a field here and inject in main.go.
package app

import (
	"ofenes/internal/config"
	"ofenes/internal/repository"
	"ofenes/internal/ws"

	"github.com/jackc/pgx/v5/pgxpool"
)

// App is the dependency injection container for the application.
// All handlers and middleware receive a pointer to this struct.
type App struct {
	Config      *config.Config
	DB          *pgxpool.Pool
	UserRepo    repository.UserRepository
	RoomRepo    repository.RoomRepository
	MessageRepo repository.MessageRepository
	MediaRepo   repository.MediaSessionRepository
	FileRepo    repository.SharedFileRepository
	Hub         *ws.Hub
}

// New creates a new App with the given dependencies.
func New(
	cfg *config.Config,
	db *pgxpool.Pool,
	userRepo repository.UserRepository,
	roomRepo repository.RoomRepository,
	messageRepo repository.MessageRepository,
	mediaRepo repository.MediaSessionRepository,
	fileRepo repository.SharedFileRepository,
	hub *ws.Hub,
) *App {
	return &App{
		Config:      cfg,
		DB:          db,
		UserRepo:    userRepo,
		RoomRepo:    roomRepo,
		MessageRepo: messageRepo,
		MediaRepo:   mediaRepo,
		FileRepo:    fileRepo,
		Hub:         hub,
	}
}
