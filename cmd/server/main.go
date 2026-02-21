// Package main is the entry point for the ofenes backend server.
package main

import (
	"log"
	"net/http"

	"ofenes/internal/handler"
	"ofenes/internal/ws"
)

func main() {
	// --- WebSocket Hub ---
	// Create the Hub and start its event loop in a background goroutine.
	// The Hub must be running before any client can connect.
	hub := ws.NewHub()
	go hub.Run()

	// --- Routes ---
	mux := http.NewServeMux()

	// REST endpoints
	mux.HandleFunc("GET /api/hello", handler.HelloHandler)

	// WebSocket endpoint — upgrades HTTP to WS and registers the client with the Hub.
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(hub, w, r)
	})

	// --- Start Server ---
	addr := ":8080"
	log.Printf("🚀 Backend server starting on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
