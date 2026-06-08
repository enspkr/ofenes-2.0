// Package auth provides authentication utilities: password hashing and JWT tokens.
package auth

import (
	"golang.org/x/crypto/bcrypt"
)

// DefaultCost is the bcrypt cost factor.
// Higher = more secure but slower. 12 is a good balance.
const DefaultCost = 12

// HashPassword generates a bcrypt hash from a plaintext password.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// CheckPassword compares a plaintext password against a bcrypt hash.
// Returns nil on success, an error on mismatch.
func CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
