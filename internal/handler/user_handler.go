package handler

import (
	"net/http"

	"ofenes/internal/middleware"
	"ofenes/pkg/response"
)

// Me handles GET /api/me (protected).
// Returns the currently authenticated user's info from the JWT context.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := middleware.GetUserID(ctx)

	user, err := h.app.UserRepo.GetByID(ctx, userID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "user not found")
		return
	}

	response.JSON(w, http.StatusOK, user)
}
