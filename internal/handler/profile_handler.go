package handler

import (
	"encoding/json"
	"net/http"

	"ofenes/internal/middleware"
	"ofenes/internal/models"
	"ofenes/pkg/response"
)

// UpdateProfile handles PUT /api/me/profile.
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	userID := middleware.GetUserID(ctx)

	user, err := h.app.UserRepo.GetByID(ctx, userID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "user not found")
		return
	}

	user.DisplayName = req.DisplayName
	user.AvatarURL = req.AvatarURL
	user.Bio = req.Bio

	if err := h.app.UserRepo.Update(ctx, user); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	response.JSON(w, http.StatusOK, user)
}

// UpdatePreferences handles PUT /api/me/preferences.
func (h *Handler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	var prefs json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	ctx := r.Context()
	userID := middleware.GetUserID(ctx)

	if err := h.app.UserRepo.UpdatePreferences(ctx, userID, prefs); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update preferences")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
