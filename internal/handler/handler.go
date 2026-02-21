// Package handler contains HTTP handlers for REST API endpoints.
package handler

import (
	"net/http"

	"ofenes/pkg/response"
)

// HelloHandler returns a simple JSON greeting.
// This is the initial "smoke test" endpoint; future handlers for
// login, file uploads, etc. will follow the same pattern.
func HelloHandler(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Hello World",
	})
}
