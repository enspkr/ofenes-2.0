// Package router centralizes all route registration.
//
// This is the single place where routes, middleware, and handler methods
// are wired together. A new engineer can open this file and immediately
// see every endpoint in the application.
package router

import (
	"net/http"

	"ofenes/internal/app"
	"ofenes/internal/handler"
	"ofenes/internal/middleware"
	"ofenes/internal/ws"
)

// New creates a fully configured HTTP handler with all routes and middleware.
func New(application *app.App) http.Handler {
	h := handler.New(application)
	mux := http.NewServeMux()

	// --- Public Routes (no auth required) ---
	mux.HandleFunc("GET /api/hello", h.HelloHandler)
	mux.HandleFunc("POST /api/register", h.Register)
	mux.HandleFunc("POST /api/login", h.Login)

	// --- Protected Routes (JWT required) ---
	authMw := middleware.Auth(application.Config.JWTSecret)
	mux.Handle("GET /api/me", authMw(http.HandlerFunc(h.Me)))

	// --- WebSocket ---
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(application.Hub, w, r)
	})

	// --- Apply global middleware stack ---
	// Order: CORS → Logging → Router
	// (outermost middleware runs first)
	var handler http.Handler = mux
	handler = middleware.Logging(handler)
	handler = middleware.CORS(application.Config.AllowOrigins)(handler)

	return handler
}
