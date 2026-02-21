.PHONY: run-backend run-frontend dev build clean

# Run the Go backend
run-backend:
	go run ./cmd/server/

# Run the Vite dev server
run-frontend:
	cd frontend && npm run dev

# Run both services concurrently (Ctrl+C to stop both)
dev:
	@echo "🚀 Starting backend on :8080 and frontend on :5173..."
	@$(MAKE) run-backend & $(MAKE) run-frontend & wait

# Build production artifacts
build:
	go build -o bin/server ./cmd/server/
	cd frontend && npm run build

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf frontend/dist/
