package handler

import (
	"net/http"
	"strconv"
	"time"

	"ofenes/internal/models"
	"ofenes/pkg/response"
)

// GetRoomMessages handles GET /api/rooms/{id}/messages?before=TIMESTAMP&limit=50.
// Returns chat history for a room using cursor-based pagination.
func (h *Handler) GetRoomMessages(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	// Parse cursor (before timestamp)
	before := time.Now()
	if v := r.URL.Query().Get("before"); v != "" {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			before = t
		}
	}

	// Parse limit
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	messages, err := h.app.MessageRepo.GetByRoom(r.Context(), roomID, before, limit)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to get messages")
		return
	}
	if messages == nil {
		messages = []*models.ChatMessage{}
	}

	response.JSON(w, http.StatusOK, messages)
}
