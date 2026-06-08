package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"ofenes/internal/middleware"
	"ofenes/internal/models"
	"ofenes/internal/repository"
	"ofenes/pkg/response"

	"github.com/google/uuid"
)

// CreateRoom handles POST /api/rooms.
func (h *Handler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	var req models.CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		response.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.Type == "" {
		req.Type = models.RoomTypePublic
	}
	if req.MaxMembers <= 0 {
		req.MaxMembers = 50
	}

	userID := middleware.GetUserID(r.Context())
	now := time.Now()

	room := &models.Room{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Description: req.Description,
		Type:      req.Type,
		CreatedBy: userID,
		IsActive:  true,
		MaxMembers: req.MaxMembers,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := h.app.RoomRepo.Create(r.Context(), room); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to create room")
		return
	}

	// Add the creator as owner
	if err := h.app.RoomRepo.AddMember(r.Context(), room.ID, userID, models.RoomRoleOwner); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to add creator as member")
		return
	}

	response.JSON(w, http.StatusCreated, room)
}

// ListRooms handles GET /api/rooms.
// Returns rooms the current user is a member of.
func (h *Handler) ListRooms(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	limit, offset := parsePagination(r)

	rooms, err := h.app.RoomRepo.List(r.Context(), userID, limit, offset)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list rooms")
		return
	}
	if rooms == nil {
		rooms = []*models.Room{}
	}

	response.JSON(w, http.StatusOK, rooms)
}

// ListPublicRooms handles GET /api/rooms/public.
func (h *Handler) ListPublicRooms(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	rooms, err := h.app.RoomRepo.ListPublic(r.Context(), limit, offset)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to list rooms")
		return
	}
	if rooms == nil {
		rooms = []*models.Room{}
	}

	response.JSON(w, http.StatusOK, rooms)
}

// GetRoom handles GET /api/rooms/{id}.
func (h *Handler) GetRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	room, err := h.app.RoomRepo.GetByID(r.Context(), roomID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "room not found")
			return
		}
		response.Error(w, http.StatusInternalServerError, "failed to get room")
		return
	}

	response.JSON(w, http.StatusOK, room)
}

// UpdateRoom handles PUT /api/rooms/{id}.
func (h *Handler) UpdateRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	// Check membership + role
	userID := middleware.GetUserID(r.Context())
	role, err := h.app.RoomRepo.GetMemberRole(r.Context(), roomID, userID)
	if err != nil || (role != models.RoomRoleOwner && role != models.RoomRoleModerator) {
		response.Error(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	room, err := h.app.RoomRepo.GetByID(r.Context(), roomID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "room not found")
		return
	}

	var req models.UpdateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		room.Name = *req.Name
	}
	if req.Description != nil {
		room.Description = req.Description
	}
	if req.MaxMembers != nil {
		room.MaxMembers = *req.MaxMembers
	}

	if err := h.app.RoomRepo.Update(r.Context(), room); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update room")
		return
	}

	response.JSON(w, http.StatusOK, room)
}

// DeleteRoom handles DELETE /api/rooms/{id}.
func (h *Handler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	userID := middleware.GetUserID(r.Context())
	role, err := h.app.RoomRepo.GetMemberRole(r.Context(), roomID, userID)
	if err != nil || role != models.RoomRoleOwner {
		response.Error(w, http.StatusForbidden, "only the room owner can delete")
		return
	}

	if err := h.app.RoomRepo.Delete(r.Context(), roomID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to delete room")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// JoinRoom handles POST /api/rooms/{id}/join.
func (h *Handler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	room, err := h.app.RoomRepo.GetByID(r.Context(), roomID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "room not found")
			return
		}
		response.Error(w, http.StatusInternalServerError, "failed to get room")
		return
	}

	if !room.IsActive {
		response.Error(w, http.StatusGone, "room is no longer active")
		return
	}

	userID := middleware.GetUserID(r.Context())
	if err := h.app.RoomRepo.AddMember(r.Context(), roomID, userID, models.RoomRoleMember); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to join room")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "joined"})
}

// LeaveRoom handles POST /api/rooms/{id}/leave.
func (h *Handler) LeaveRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	userID := middleware.GetUserID(r.Context())
	if err := h.app.RoomRepo.RemoveMember(r.Context(), roomID, userID); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to leave room")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "left"})
}

// GetRoomMembers handles GET /api/rooms/{id}/members.
func (h *Handler) GetRoomMembers(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		response.Error(w, http.StatusBadRequest, "missing room id")
		return
	}

	members, err := h.app.RoomRepo.GetMembers(r.Context(), roomID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to get members")
		return
	}
	if members == nil {
		members = []*models.RoomMember{}
	}

	response.JSON(w, http.StatusOK, members)
}

// parsePagination extracts limit and offset from query params with defaults.
func parsePagination(r *http.Request) (int, int) {
	limit := 50
	offset := 0

	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	return limit, offset
}
