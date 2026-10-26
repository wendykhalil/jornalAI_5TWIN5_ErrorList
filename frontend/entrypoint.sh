#!/bin/sh
set -e

# ==============================================================================
# Frontend Nginx Container Entrypoint
# Ensures TLS certificate files exist before starting Nginx.
# If no Let's Encrypt certificate is found, creates a strong self-signed bootstrap
# certificate for 20.240.53.98 so HTTPS is enforced immediately.
# ==============================================================================

SSL_DIR="/etc/nginx/ssl/live"
mkdir -p "$SSL_DIR"

if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
    echo "=== Initializing TLS Bootstrap Certificate for mindlog-ai.swedencentral.cloudapp.azure.com ==="
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/CN=mindlog-ai.swedencentral.cloudapp.azure.com/O=Jornal AI/C=TN" \
        -addext "subjectAltName=DNS:mindlog-ai.swedencentral.cloudapp.azure.com,IP:20.240.53.98,DNS:localhost"
    echo "Bootstrap certificate ready."
fi

# Ensure certbot webroot directory exists
mkdir -p /var/www/certbot

echo "Starting Nginx on ports 80 (HTTP redirect) and 443 (HTTPS)..."
exec nginx -g "daemon off;"
