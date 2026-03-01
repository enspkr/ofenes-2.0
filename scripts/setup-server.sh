#!/bin/bash
# ============================================================
# ofenes — Server Setup Script
# ============================================================
# Run this on a fresh VPS (Ubuntu/Debian) as root or with sudo.
# Usage: sudo bash setup-server.sh
# ============================================================

set -euo pipefail

echo "=== Updating system ==="
apt-get update && apt-get upgrade -y

echo "=== Installing Docker ==="
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings

# Detect distro (ubuntu or debian)
. /etc/os-release
DISTRO="$ID"
if [ "$DISTRO" != "ubuntu" ] && [ "$DISTRO" != "debian" ]; then
    echo "WARNING: Unsupported distro '$DISTRO', trying debian..."
    DISTRO="debian"
fi

curl -fsSL "https://download.docker.com/linux/$DISTRO/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$DISTRO $VERSION_CODENAME stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "=== Enabling Docker ==="
systemctl enable docker
systemctl start docker

echo "=== Installing UFW firewall ==="
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== Creating app directory ==="
mkdir -p /opt/ofenes
echo "Place your project files in /opt/ofenes"

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Copy your project to /opt/ofenes on this server"
echo "  2. Edit /opt/ofenes/.env.production with your domain and secrets"
echo "  3. Run: cd /opt/ofenes && bash scripts/deploy.sh"
