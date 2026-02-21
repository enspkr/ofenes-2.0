// Package handler contains HTTP handlers for REST API endpoints.
//
// All handlers are methods on the Handler struct, which receives
// the App dependency container. This makes dependencies explicit
// and avoids global state.
package handler

import (
	"net/http"

	"ofenes/internal/app"
	"ofenes/pkg/response"
)

// Handler holds shared dependencies for all HTTP handlers.
// Created once in main.go and used to register routes.
type Handler struct {
	app *app.App
}

// New creates a new Handler with the given application container.
func New(application *app.App) *Handler {
	return &Handler{app: application}
}

// HelloHandler is a health-check / smoke-test endpoint.
func (h *Handler) HelloHandler(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Hello World",
		"status":  "ok",
	})
}
