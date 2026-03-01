#!/bin/bash
# ============================================================
# ofenes — Deploy Script
# ============================================================
# Run this from the project root on the server.
# Usage: bash scripts/deploy.sh
#
# Assumes:
#   - Nginx is installed as a system service
#   - certbot is installed (apt install certbot python3-certbot-nginx)
#   - Docker is installed
# ============================================================

set -euo pipefail

DOMAIN="dev.ofenes.com"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEBROOT="/var/www/$DOMAIN"

echo "=== ofenes deploy: $DOMAIN ==="
echo "App directory: $APP_DIR"

# --- Check .env.production ---
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo "ERROR: .env.production not found."
    echo "Copy and fill in the values:"
    echo "  cp $APP_DIR/.env.production.example $APP_DIR/.env.production (if example exists)"
    echo "  Or create it manually — see .env.example for reference"
    exit 1
fi

source "$APP_DIR/.env.production"

if [ "${JWT_SECRET:-}" = "CHANGE_ME_TO_A_RANDOM_SECRET" ] || [ -z "${JWT_SECRET:-}" ]; then
    echo "ERROR: Set a real JWT_SECRET in .env.production"
    echo "Generate one with: openssl rand -base64 32"
    exit 1
fi

# --- Build frontend ---
echo ""
echo "=== Building frontend ==="
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "=== Deploying frontend to $WEBROOT ==="
mkdir -p "$WEBROOT"
cp -r "$APP_DIR/frontend/dist/." "$WEBROOT/"

# --- Install Nginx config ---
echo ""
echo "=== Installing Nginx config ==="
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
cp "$APP_DIR/nginx/$DOMAIN.conf" "$NGINX_CONF"
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"

# --- Obtain SSL certificate if not yet present ---
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo ""
    echo "=== Obtaining SSL certificate ==="

    # Temporarily serve only port 80 so certbot can verify
    TEMP_CONF="/etc/nginx/sites-available/${DOMAIN}.tmp"
    cat > "$TEMP_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'ok'; }
}
EOF
    ln -sf "$TEMP_CONF" "/etc/nginx/sites-enabled/${DOMAIN}.tmp"
    rm -f "/etc/nginx/sites-enabled/$DOMAIN"
    nginx -t && systemctl reload nginx

    mkdir -p /var/www/certbot
    certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email "admin@ofenes.com" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    rm -f "/etc/nginx/sites-enabled/${DOMAIN}.tmp" "$TEMP_CONF"
    ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"

    echo "=== SSL certificate obtained ==="
fi

# --- Test and reload Nginx ---
echo ""
echo "=== Reloading Nginx ==="
nginx -t
systemctl reload nginx

# --- Start backend via Docker ---
echo ""
echo "=== Starting backend ==="
cd "$APP_DIR"
docker compose -f docker-compose.prod.yaml up -d --build

echo ""
echo "=== Deployment complete ==="
echo "Your app is live at: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  Logs:    docker compose -f docker-compose.prod.yaml logs -f"
echo "  Stop:    docker compose -f docker-compose.prod.yaml down"
echo "  Restart: docker compose -f docker-compose.prod.yaml restart"
