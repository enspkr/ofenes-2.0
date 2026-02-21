// Package config loads application configuration from environment variables.
//
// Every configurable value in the application flows through this package.
// No other package should read os.Getenv directly — add it here instead.
//
// Usage:
//
//	cfg, err := config.Load()
//	if err != nil {
//	    log.Fatal(err)
//	}
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration.
// All values are populated from environment variables via Load().
type Config struct {
	// Server
	Port string // SERVER_PORT — HTTP listen port (default: "8080")

	// JWT
	JWTSecret string        // JWT_SECRET — signing key (required in production)
	JWTExpiry time.Duration // JWT_EXPIRY_HOURS — token lifetime (default: 24h)

	// CORS
	AllowOrigins string // CORS_ORIGINS — comma-separated allowed origins (default: "http://localhost:5173")

	// WebSocket
	WSMaxMessageSize int64 // WS_MAX_MESSAGE_SIZE — max bytes per WS message (default: 4096)
}

// Load reads configuration from environment variables.
// It returns an error if a required variable is missing.
func Load() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("SERVER_PORT", "8080"),
		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-change-me-in-production"),
		AllowOrigins:     getEnv("CORS_ORIGINS", "http://localhost:5173"),
		WSMaxMessageSize: getEnvInt64("WS_MAX_MESSAGE_SIZE", 4096),
	}

	// Parse JWT expiry
	expiryHours := getEnvInt("JWT_EXPIRY_HOURS", 24)
	cfg.JWTExpiry = time.Duration(expiryHours) * time.Hour

	// Validate required fields
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config: JWT_SECRET is required")
	}

	return cfg, nil
}

// getEnv reads an env var or returns a default value.
func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

// getEnvInt reads an env var as int or returns a default value.
func getEnvInt(key string, fallback int) int {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

// getEnvInt64 reads an env var as int64 or returns a default value.
func getEnvInt64(key string, fallback int64) int64 {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	n, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return fallback
	}
	return n
}
