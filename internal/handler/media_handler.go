package handler

import (
	"net/http"

	"ofenes/internal/models"
	"ofenes/pkg/response"
)

// GetRoomMediaSessions handles GET /api/rooms/{id}/media-sessions.
func (h *Handler) GetRoomMediaSessions(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	limit, offset := parsePagination(r)

	sessions, err := h.app.MediaRepo.GetByRoom(r.Context(), roomID, limit, offset)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to get media sessions")
		return
	}
	if sessions == nil {
		sessions = []*models.MediaSession{}
	}

	response.JSON(w, http.StatusOK, sessions)
}

// GetRoomFiles handles GET /api/rooms/{id}/files.
func (h *Handler) GetRoomFiles(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	limit, offset := parsePagination(r)

	files, err := h.app.FileRepo.GetByRoom(r.Context(), roomID, limit, offset)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to get files")
		return
	}
	if files == nil {
		files = []*models.SharedFile{}
	}

	response.JSON(w, http.StatusOK, files)
}
