# ofenes — Agent Guide

A real-time collaborative platform with WebRTC video/audio chat, screen sharing, synchronized video watching, and text messaging. Go backend + React/TypeScript frontend.

---

## Project Structure

```
ofenes/
├── cmd/server/main.go              # Go entry point (loads config, wires deps, starts HTTP server on :8080)
├── internal/
│   ├── app/app.go                  # DI container (Config, UserRepo, Hub)
│   ├── config/config.go            # Env-based config (SERVER_PORT, JWT_SECRET, CORS_ORIGINS, etc.)
│   ├── auth/
│   │   ├── jwt.go                  # JWT generation + validation (HS256, golang-jwt/jwt/v5)
│   │   └── hash.go                 # bcrypt password hashing (cost 12)
│   ├── handler/
│   │   ├── handler.go              # GET /api/hello (health check)
│   │   ├── auth_handler.go         # POST /api/register, POST /api/login
│   │   └── user_handler.go         # GET /api/me (protected)
│   ├── middleware/
│   │   ├── auth.go                 # JWT extraction from Authorization header, injects claims into context
│   │   ├── cors.go                 # Configurable CORS (reads AllowOrigins from config)
│   │   └── logging.go             # Request logging (method, path, status, duration)
│   ├── models/models.go           # Shared types: User, Message, VideoState, Room, auth DTOs
│   ├── repository/
│   │   ├── user_repository.go     # UserRepository interface (Create, GetByID, GetByUsername)
│   │   └── memory.go              # In-memory implementation (map + RWMutex) — no persistence
│   ├── router/router.go           # Route registration, middleware stack: CORS -> Logging -> Routes
│   └── ws/
│       ├── hub.go                 # WebSocket hub: client registry, message routing by type, user_list broadcasts
│       └── client.go              # Per-connection: readPump/writePump goroutines, ping/pong keepalive, message batching
├── pkg/response/response.go       # JSON response helper
├── frontend/
│   ├── src/
│   │   ├── main.tsx               # React entry: AuthProvider + App
│   │   ├── App.tsx                # Layout: Header (online count, branding, user info) + MediaPanel + Chat
│   │   ├── types/models.ts        # TS mirrors of Go models (User, Message, VideoState, Room, auth DTOs)
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx        # Auth context provider, localStorage persistence, token validation on mount
│   │   │   ├── useWebSocket.ts    # Auto-reconnect with exponential backoff, message batching (split on \n)
│   │   │   ├── useWebRTC.ts       # Peer connections, media streams, screen share with audio, signaling
│   │   │   └── useVideoSync.ts    # Synchronized video playback (play/pause/seek/load events)
│   │   └── components/
│   │       ├── Login.tsx           # Register/Login form with glassmorphic styling
│   │       ├── MediaPanel.tsx      # Video grid + call controls + audio routing (GainNode per user)
│   │       ├── VideoTile.tsx       # Single video tile: speaking indicator, pin modes, volume sliders
│   │       ├── VideoPlayer.tsx     # react-player wrapper with sync controls
│   │       └── Chat.tsx            # Resizable chat panel (280-600px), message bubbles, system messages
│   ├── vite.config.ts             # Dev proxy: /api -> :8080, /ws -> :8080 (ws: true)
│   ├── package.json               # React 19, Tailwind CSS v4, Vite 6, TypeScript 5.7
│   └── index.css                  # Global styles
├── Makefile                       # dev (both), run-backend, run-frontend, build, clean
├── docker-compose.yaml            # backend + frontend containers
├── backend.Dockerfile             # Multi-stage Go build (alpine)
├── frontend.Dockerfile            # Node dev server (alpine)
└── .env.example                   # Environment variable template
```

---

## How to Run

```bash
make dev              # Backend (:8080) + Frontend (:5173) concurrently
make run-backend      # Backend only
make run-frontend     # Frontend only
docker compose up     # Via Docker
```

Frontend dev server proxies `/api` and `/ws` to the backend automatically.

---

## Architecture Overview

### Backend (Go)

**Request flow:** HTTP Request -> CORS middleware -> Logging middleware -> Auth middleware (protected routes) -> Handler -> Repository -> Response

**WebSocket flow:** Client connects to `GET /ws?token=<JWT>` -> JWT validated before upgrade -> Hub registers client -> readPump/writePump goroutines handle bidirectional messaging

**Message routing in Hub** (`ws/hub.go`):
- `chat` -> broadcast to all
- `video_sync` -> store as lastVideoState + broadcast (late joiners get current state)
- `webrtc` -> route to target user by username (peer-to-peer signaling)
- `user_list` -> auto-broadcast on join/leave
- `admin` -> broadcast to all

### Frontend (React + TypeScript)

**Component tree:**
```
AuthProvider
  App
    Login (if not authenticated)
    Dashboard (if authenticated)
      Header (online count, branding, user info, logout)
      MediaPanel (video grid, call controls, audio routing)
        VideoTile[] (per-user video, speaking indicator, volume sliders, pin modes)
      Chat (resizable, message bubbles, input, toolbar)
```

**Hook responsibilities:**
| Hook | Purpose |
|------|---------|
| `useAuth` | JWT auth state, login/register/logout, localStorage persistence |
| `useWebSocket` | WebSocket connection, auto-reconnect, message parsing, batching support |
| `useWebRTC` | RTCPeerConnection management, media streams, screen share, signaling |
| `useVideoSync` | Synchronized video playback across users |

---

## WebRTC Implementation

### Signaling (via WebSocket)

Messages use type `webrtc` with JSON payload containing `event`, `target`, `sender`, and either `sdp` or `candidate`.

**Connection flow:**
1. User A joins call -> `getUserMedia()` -> creates offer for each connected user
2. Hub routes offer to target user by username
3. Target auto-joins if not in call -> creates answer
4. ICE candidates exchanged bidirectionally
5. Media flows peer-to-peer

### Stream Management

Each peer connection carries up to 3 tracks:
- **Camera video track** — replaced via `replaceTrack()` when screen sharing
- **Mic audio track** — always present while in call
- **Screen audio track** — added via `addTrack()`, triggers renegotiation

**Stream identification** (`remoteStreamIdsRef`):
- First stream from a peer = camera/mic (stored by username -> stream ID)
- Subsequent different stream ID = screen audio (`remoteScreenAudioStreams`)

### Screen Sharing

- `getDisplayMedia({ video: { height: { ideal } }, audio: true })`
- Video track replaces camera track on all peer connections
- Audio track added separately (triggers `onnegotiationneeded` -> renegotiation)
- Quality picker: 720p (data saver), 1080p (default), 1440p (high quality)
- Late joiners: `createPeerConnection` checks `screenStreamRef.current` and sends screen tracks

### Audio Routing

`useRemoteAudio` hook in MediaPanel.tsx:
- Creates `AudioContext` + `GainNode` per remote user for mic audio
- Separate `GainNode` per user for screen share audio (keyed as `${username}:screen`)
- Volume controlled via range sliders in VideoTile (0-1, step 0.05)
- Deafen toggle mutes/unmutes all GainNodes

---

## Data Models

### Go (internal/models/models.go)

```go
User     { ID, Username, PasswordHash, Role, CreatedAt }  // Roles: admin, member, viewer
Message  { Type, Sender, Payload, Timestamp }              // Type: chat|system|video_sync|webrtc|user_list|admin
Room     { ID, Name, OwnerID, VideoState, CreatedAt }
```

### TypeScript (frontend/src/types/models.ts)

Mirrors Go structs. Message type is a union: `'chat' | 'system' | 'video_sync' | 'webrtc' | 'user_list' | 'admin'`

---

## Key Design Decisions

1. **In-memory storage** — No database yet. `UserRepository` interface exists for easy swap to PostgreSQL.
2. **JWT in query param for WebSocket** — Can't set headers on WebSocket upgrade; token passed as `?token=`.
3. **Message batching** — Go's writePump batches messages with `\n` separator; frontend splits on `\n`.
4. **Web Audio API for volume** — `GainNode` per user enables per-user volume control without modifying streams.
5. **replaceTrack for screen video** — Avoids renegotiation for video swap. `addTrack` used for screen audio (requires renegotiation).
6. **Tailwind CSS v4** — Utility-first, dark theme with glassmorphic design (slate-900 base, cyan/blue/violet accents).

---

## Common Patterns

### Adding a new API endpoint

1. Add handler function in `internal/handler/` (receives `*app.App`)
2. Register route in `internal/router/router.go` (wrap with auth middleware if protected)
3. Add types to `internal/models/models.go` if needed

### Adding a new WebSocket message type

1. Add type string to `Message.Type` in both Go models and TS types
2. Add routing case in `Hub.routeMessage()` (`internal/ws/hub.go`)
3. Handle in frontend hook (filter by type in useWebSocket messages array)

### Adding a new UI component

1. Create component in `frontend/src/components/`
2. Extract logic into a hook in `frontend/src/hooks/` if complex
3. Wire into `App.tsx` or parent component
4. Pass WebRTC/WebSocket state via props from Dashboard

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SERVER_PORT` | `8080` | Backend HTTP port |
| `JWT_SECRET` | `dev-secret-change-me-in-production` | JWT signing key |
| `JWT_EXPIRY_HOURS` | `24` | Token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed origins (comma-separated) |
| `WS_MAX_MESSAGE_SIZE` | `4096` | WebSocket max message bytes (overridden to 65536 in code for SDP) |

---

## Known Limitations

- **No persistence** — All data lost on server restart (in-memory repo)
- **No TURN server** — WebRTC fails behind strict NAT/firewalls (STUN only)
- **Single process** — WebSocket hub can't scale horizontally (no Redis/pub-sub)
- **No tests** — No unit or integration tests exist yet
- **Permissive WebSocket CORS** — `CheckOrigin` returns true for all origins
