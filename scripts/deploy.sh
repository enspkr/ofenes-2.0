#!/bin/bash
# ============================================================
# ofenes — Deploy Script
# ============================================================
# Run this from the project root on the server.
# Usage: bash scripts/deploy.sh
# ============================================================

set -euo pipefail

# Load domain from .env.production
if [ ! -f .env.production ]; then
    echo "ERROR: .env.production not found. Copy .env.production and fill in your values."
    exit 1
fi

source .env.production

if [ "$DOMAIN" = "your-domain.com" ] || [ -z "$DOMAIN" ]; then
    echo "ERROR: Set your DOMAIN in .env.production"
    exit 1
fi

if [ "$JWT_SECRET" = "CHANGE_ME_TO_A_RANDOM_SECRET" ]; then
    echo "ERROR: Set a real JWT_SECRET in .env.production"
    echo "Generate one with: openssl rand -base64 32"
    exit 1
fi

# Check if SSL certificate already exists
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
    echo "=== Obtaining SSL certificate ==="

    # Start a temporary nginx for the ACME challenge
    docker compose -f docker-compose.prod.yaml run --rm -p 80:80 \
        -v certbot-webroot:/var/www/certbot \
        frontend sh -c "echo 'server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'" &
    NGINX_PID=$!
    sleep 3

    # Request the certificate
    docker compose -f docker-compose.prod.yaml run --rm \
        certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@$DOMAIN \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN

    kill $NGINX_PID 2>/dev/null || true
    docker compose -f docker-compose.prod.yaml down 2>/dev/null || true

    echo "=== SSL certificate obtained ==="
fi

echo "=== Building and starting services ==="
export DOMAIN
docker compose -f docker-compose.prod.yaml build
docker compose -f docker-compose.prod.yaml up -d

echo ""
echo "=== Deployment complete ==="
echo "Your app is live at: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  Logs:    docker compose -f docker-compose.prod.yaml logs -f"
echo "  Stop:    docker compose -f docker-compose.prod.yaml down"
echo "  Restart: docker compose -f docker-compose.prod.yaml restart"
