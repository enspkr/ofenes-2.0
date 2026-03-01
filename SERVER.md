# Server Deployment — ofenes

This document explains how the production server is structured, how each part works, and how to manage it.

---

## Architecture Overview

```
Internet
   │
   ▼
[Nginx]  (system service, ports 80 + 443)
   │
   ├── HTTPS  →  /var/www/dev.ofenes.com/   (React static files)
   ├── /api/* →  proxy → localhost:8080     (Go backend)
   └── /ws    →  proxy → localhost:8080     (WebSocket)
                              │
                         [Docker]
                       Go binary in
                       Alpine container
```

There are two processes running on the server:

| Process | How it runs | Port |
|---------|-------------|------|
| Nginx | System service (`systemctl`) | 80, 443 (public) |
| Go backend | Docker container | 8080 (localhost only) |

The frontend is **not a running process** — it is pre-built static HTML/CSS/JS files served directly by Nginx.

---

## Files on the Server

| Path | What it is |
|------|-----------|
| `/opt/ofenes/ofenes-2.0/` | Project source code |
| `/opt/ofenes/ofenes-2.0/.env.production` | Production secrets (not in git) |
| `/var/www/dev.ofenes.com/` | Built frontend static files |
| `/etc/nginx/sites-available/dev.ofenes.com` | Nginx config for this site |
| `/etc/nginx/sites-enabled/dev.ofenes.com` | Symlink to activate the config |
| `/etc/letsencrypt/live/dev.ofenes.com/` | SSL certificate (auto-renewed) |

---

## How Nginx Routes Traffic

The Nginx config (`nginx/dev.ofenes.com.conf`) has two server blocks:

**Port 80 (HTTP):** Redirects all traffic to HTTPS. The only exception is `/.well-known/acme-challenge/` which certbot uses to renew SSL certificates.

**Port 443 (HTTPS):**

- `GET /` and any frontend route → served from `/var/www/dev.ofenes.com/`. Uses `try_files $uri /index.html` so React's client-side routing works (refreshing any page works correctly).
- `GET /api/*` → proxied to `http://127.0.0.1:8080`. The Go backend handles all REST API calls.
- `GET /ws` → proxied to `http://127.0.0.1:8080` with WebSocket upgrade headers. The `proxy_read_timeout 86400` keeps long-lived connections open.

The backend port `8080` is bound to `127.0.0.1` only (not `0.0.0.0`), so it is never directly reachable from the internet — all traffic must go through Nginx.

---

## SSL Certificate

SSL is handled by [Let's Encrypt](https://letsencrypt.org/) via `certbot`.

- Certificate lives at `/etc/letsencrypt/live/dev.ofenes.com/`
- Auto-renewal is managed by the certbot systemd timer (`systemctl status certbot.timer`)
- On first deploy, `scripts/deploy.sh` obtains the certificate automatically using the webroot method

To manually renew:
```bash
certbot renew
systemctl reload nginx
```

---

## Go Backend (Docker)

The backend runs inside a Docker container defined in `docker-compose.prod.yaml`.

**Build:** `backend.Dockerfile` does a two-stage build:
1. `golang:1.23-alpine` compiles the Go binary
2. `alpine:3.19` runs it — the final image is small (~15 MB) with no Go toolchain

**Configuration** is loaded from `.env.production` at startup via environment variables. Key variables:

| Variable | Purpose |
|----------|---------|
| `SERVER_PORT` | Port the Go server listens on (8080) |
| `JWT_SECRET` | Signs and verifies JWT tokens |
| `CORS_ORIGINS` | Allowed origins for CORS (`https://dev.ofenes.com`) |
| `WS_MAX_MESSAGE_SIZE` | Max WebSocket message size in bytes |

**Storage:** The app uses in-memory storage — there is no database. All users and sessions are lost when the container restarts.

---

## Deploying Updates

After pushing changes to the server (`rsync` or `git pull`):

```bash
cd /opt/ofenes/ofenes-2.0
bash scripts/deploy.sh
```

The script does the following in order:
1. Validates `.env.production` exists and has a real `JWT_SECRET`
2. Runs `npm ci && npm run build` inside `frontend/`
3. Copies `frontend/dist/` to `/var/www/dev.ofenes.com/`
4. Installs the Nginx config and enables it
5. Obtains an SSL certificate if one doesn't exist yet
6. Tests and reloads Nginx
7. Rebuilds and restarts the Docker backend container

---

## Day-to-Day Commands

**View backend logs:**
```bash
docker compose -f /opt/ofenes/ofenes-2.0/docker-compose.prod.yaml logs -f
```

**Restart the backend:**
```bash
docker compose -f /opt/ofenes/ofenes-2.0/docker-compose.prod.yaml restart
```

**Stop everything:**
```bash
docker compose -f /opt/ofenes/ofenes-2.0/docker-compose.prod.yaml down
```

**Check Nginx status:**
```bash
systemctl status nginx
nginx -t          # test config before reloading
systemctl reload nginx
```

**Check SSL certificate expiry:**
```bash
certbot certificates
```
