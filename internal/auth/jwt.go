package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Custom errors for JWT operations.
var (
	ErrInvalidToken = errors.New("auth: invalid or expired token")
)

// Claims defines the JWT payload structure.
// Embeds jwt.RegisteredClaims for standard fields (exp, iat, sub).
type Claims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateToken creates a signed JWT for the given user.
// The secret and expiry are passed in (from config) — not hardcoded.
func GenerateToken(userID, username, role, secret string, expiry time.Duration) (string, error) {
	now := time.Now()

	claims := &Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken parses and validates a JWT string.
// Returns the claims on success, or ErrInvalidToken on failure.
func ValidateToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		// Ensure the signing method is HMAC (prevent algorithm confusion attacks)
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
