# ofenes

A real-time collaborative platform built with Go and React.

## Tech Stack

| Layer     | Technology                       |
|-----------|----------------------------------|
| Backend   | Go (standard library + gorilla/websocket) |
| Frontend  | React 19 + Vite 6 + TypeScript   |
| Styling   | Tailwind CSS v4                  |
| Real-time | WebSocket (gorilla/websocket)    |

## Quick Start

### Prerequisites

- [Go 1.23+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/)

### Setup

```bash
# Backend
go mod tidy

# Frontend
cd frontend && npm install
```

### Development

```bash
# Run both services (backend :8080, frontend :5173)
make dev
```

Or individually:

```bash
make run-backend    # Go server on :8080
make run-frontend   # Vite dev server on :5173
```

### Docker

```bash
docker compose up --build
```

## Project Structure

```
ofenes/
├── cmd/server/          # Go entry point
├── internal/
│   ├── handler/         # REST handlers
│   ├── ws/              # WebSocket hub + client
│   └── models/          # Shared data structures
├── pkg/response/        # JSON response utility
├── frontend/src/
│   ├── components/      # React components
│   ├── hooks/           # Custom hooks (useWebSocket)
│   └── types/           # TypeScript type definitions
├── Makefile
└── docker-compose.yaml
```
