package middleware

import (
	"context"
	"net/http"
	"strings"

	"ofenes/internal/auth"
	"ofenes/pkg/response"
)

// contextKey is a private type to prevent collisions in context values.
type contextKey string

// UserIDKey is the context key for the authenticated user's ID.
const UserIDKey contextKey = "userID"

// UsernameKey is the context key for the authenticated user's username.
const UsernameKey contextKey = "username"

// RoleKey is the context key for the authenticated user's role.
const RoleKey contextKey = "role"

// Auth returns middleware that validates JWT tokens from the Authorization header.
// Protected routes should be wrapped with this middleware.
//
// On success, it injects userID, username, and role into the request context.
// On failure, it returns 401 Unauthorized.
//
// Usage:
//
//	protectedHandler := middleware.Auth(cfg.JWTSecret)(myHandler)
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from "Authorization: Bearer <token>"
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Error(w, http.StatusUnauthorized, "missing authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				response.Error(w, http.StatusUnauthorized, "invalid authorization format")
				return
			}

			tokenStr := parts[1]

			// Validate the token
			claims, err := auth.ValidateToken(tokenStr, jwtSecret)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			// Inject user info into request context
			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UsernameKey, claims.Username)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// --- Context Helpers ---
// These functions extract user info from the request context.
// Use these in handlers instead of accessing context keys directly.

// GetUserID extracts the user ID from the request context.
func GetUserID(ctx context.Context) string {
	val, _ := ctx.Value(UserIDKey).(string)
	return val
}

// GetUsername extracts the username from the request context.
func GetUsername(ctx context.Context) string {
	val, _ := ctx.Value(UsernameKey).(string)
	return val
}

// GetRole extracts the user role from the request context.
func GetRole(ctx context.Context) string {
	val, _ := ctx.Value(RoleKey).(string)
	return val
}
