// Package main is the entry point for the ofenes backend server.
//
// This file is pure wiring: load config -> create dependencies -> start server.
// All logic lives in internal/ packages.
package main

import (
	"context"
	"log"
	"net/http"

	"ofenes/internal/app"
	"ofenes/internal/config"
	"ofenes/internal/database"
	"ofenes/internal/repository"
	"ofenes/internal/router"
	"ofenes/internal/ws"
)

func main() {
	// --- Load Configuration ---
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// --- Connect to PostgreSQL ---
	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DatabaseURL, cfg.DatabasePoolSize)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	// --- Run Migrations ---
	if err := database.Migrate(ctx, pool); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// --- Create Repositories (PostgreSQL) ---
	userRepo := repository.NewPgUserRepo(pool)
	roomRepo := repository.NewPgRoomRepo(pool)
	messageRepo := repository.NewPgMessageRepo(pool)
	mediaRepo := repository.NewPgMediaSessionRepo(pool)
	fileRepo := repository.NewPgSharedFileRepo(pool)

	// --- Create WebSocket Hub ---
	hub := ws.NewHub(messageRepo)
	go hub.Run()

	// --- Create Application Container ---
	application := app.New(cfg, pool, userRepo, roomRepo, messageRepo, mediaRepo, fileRepo, hub)

	// --- Create Router (wires routes + middleware) ---
	handler := router.New(application)

	// --- Start Server ---
	addr := ":" + cfg.Port
	log.Printf("Backend server starting on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
