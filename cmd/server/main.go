// Package main is the entry point for the ofenes backend server.
//
// This file is pure wiring: load config → create dependencies → start server.
// All logic lives in internal/ packages.
package main

import (
	"log"
	"net/http"

	"ofenes/internal/app"
	"ofenes/internal/config"
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

	// --- Create Dependencies ---
	userRepo := repository.NewMemoryUserRepo()
	hub := ws.NewHub()
	go hub.Run()

	// --- Create Application Container ---
	application := app.New(cfg, userRepo, hub)

	// --- Create Router (wires routes + middleware) ---
	handler := router.New(application)

	// --- Start Server ---
	addr := ":" + cfg.Port
	log.Printf("🚀 Backend server starting on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
