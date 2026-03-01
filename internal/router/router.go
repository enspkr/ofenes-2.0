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

	// User
	mux.Handle("GET /api/me", authMw(http.HandlerFunc(h.Me)))
	mux.Handle("PUT /api/me/profile", authMw(http.HandlerFunc(h.UpdateProfile)))
	mux.Handle("PUT /api/me/preferences", authMw(http.HandlerFunc(h.UpdatePreferences)))

	// Rooms
	mux.Handle("POST /api/rooms", authMw(http.HandlerFunc(h.CreateRoom)))
	mux.Handle("GET /api/rooms", authMw(http.HandlerFunc(h.ListRooms)))
	mux.Handle("GET /api/rooms/public", authMw(http.HandlerFunc(h.ListPublicRooms)))
	mux.Handle("GET /api/rooms/{id}", authMw(http.HandlerFunc(h.GetRoom)))
	mux.Handle("PUT /api/rooms/{id}", authMw(http.HandlerFunc(h.UpdateRoom)))
	mux.Handle("DELETE /api/rooms/{id}", authMw(http.HandlerFunc(h.DeleteRoom)))
	mux.Handle("POST /api/rooms/{id}/join", authMw(http.HandlerFunc(h.JoinRoom)))
	mux.Handle("POST /api/rooms/{id}/leave", authMw(http.HandlerFunc(h.LeaveRoom)))
	mux.Handle("GET /api/rooms/{id}/members", authMw(http.HandlerFunc(h.GetRoomMembers)))

	// Messages
	mux.Handle("GET /api/rooms/{id}/messages", authMw(http.HandlerFunc(h.GetRoomMessages)))

	// Media & Files
	mux.Handle("GET /api/rooms/{id}/media-sessions", authMw(http.HandlerFunc(h.GetRoomMediaSessions)))
	mux.Handle("GET /api/rooms/{id}/files", authMw(http.HandlerFunc(h.GetRoomFiles)))

	// --- WebSocket (JWT authenticated, room-scoped) ---
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(application.Hub, application.Config.JWTSecret, w, r)
	})

	// --- Apply global middleware stack ---
	// Order: CORS → Logging → Router
	// (outermost middleware runs first)
	var handler http.Handler = mux
	handler = middleware.Logging(handler)
	handler = middleware.CORS(application.Config.AllowOrigins)(handler)

	return handler
}
