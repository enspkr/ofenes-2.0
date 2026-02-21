package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"ofenes/internal/auth"
	"ofenes/internal/models"
	"ofenes/internal/repository"
	"ofenes/pkg/response"

	"github.com/google/uuid"
)

// Register handles POST /api/register.
//
// Request:  { "username": "...", "password": "..." }
// Response: { "token": "...", "user": { ... } }
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// --- Validation ---
	if req.Username == "" {
		response.Error(w, http.StatusBadRequest, "username is required")
		return
	}
	if len(req.Password) < 6 {
		response.Error(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	// --- Hash password ---
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	// --- Create user ---
	user := &models.User{
		ID:           uuid.New().String(),
		Username:     req.Username,
		PasswordHash: hash,
		Role:         models.RoleMember, // Default role
		CreatedAt:    time.Now(),
	}

	if err := h.app.UserRepo.Create(r.Context(), user); err != nil {
		if errors.Is(err, repository.ErrAlreadyExists) {
			response.Error(w, http.StatusConflict, "username already taken")
			return
		}
		response.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	// --- Generate JWT ---
	token, err := auth.GenerateToken(
		user.ID, user.Username, user.Role,
		h.app.Config.JWTSecret,
		h.app.Config.JWTExpiry,
	)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	response.JSON(w, http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  *user,
	})
}

// Login handles POST /api/login.
//
// Request:  { "username": "...", "password": "..." }
// Response: { "token": "...", "user": { ... } }
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// --- Find user ---
	user, err := h.app.UserRepo.GetByUsername(r.Context(), req.Username)
	if err != nil {
		// Don't leak whether the username exists or not
		response.Error(w, http.StatusUnauthorized, "invalid username or password")
		return
	}

	// --- Check password ---
	if err := auth.CheckPassword(user.PasswordHash, req.Password); err != nil {
		response.Error(w, http.StatusUnauthorized, "invalid username or password")
		return
	}

	// --- Generate JWT ---
	token, err := auth.GenerateToken(
		user.ID, user.Username, user.Role,
		h.app.Config.JWTSecret,
		h.app.Config.JWTExpiry,
	)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	response.JSON(w, http.StatusOK, models.AuthResponse{
		Token: token,
		User:  *user,
	})
}
