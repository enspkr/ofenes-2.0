// Package response provides reusable JSON response helpers.
package response

import (
	"encoding/json"
	"log"
	"net/http"
)

// JSON writes a JSON-encoded value to the ResponseWriter with the given status code.
// It sets the Content-Type header to application/json.
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("response.JSON: failed to encode: %v", err)
	}
}

// Error writes a JSON error response.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"error": message})
}
