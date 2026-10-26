#!/usr/bin/env bash
set -e

# ==============================================================================
# Setup Official Let's Encrypt TLS Certificate for Jornal AI / MindLog AI
# Uses the Certbot HTTP-01 challenge against the running Nginx container.
#
# Prerequisite:
# A valid FQDN (e.g. mindlog.francecentral.cloudapp.azure.com or your domain)
# pointing to 20.240.53.98.
# (Note: Let's Encrypt does not issue certificates for bare IP addresses).
# ==============================================================================

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <domain-name> <admin-email>"
  echo "Example: $0 mindlog-ai.swedencentral.cloudapp.azure.com admin@mindlog.ai"
  echo ""
  echo "Tip: For Azure VM (IP: 20.240.53.98), configure an Azure DNS name label:"
  echo "az network public-ip update --resource-group <rg> --name <ip-name> --dns-name <label>"
  exit 1
fi

DOMAIN="$1"
EMAIL="$2"
CERTBOT_DIR="./certbot"

echo "=== Requesting Let's Encrypt TLS Certificate for ${DOMAIN} ==="

# Check that frontend container is running
if ! docker ps --format '{{.Names}}' | grep -q "^jornal_frontend$"; then
  echo "Error: Container 'jornal_frontend' is not running."
  echo "Please start the stack first using: docker compose up -d"
  exit 1
fi

# Run Certbot container using webroot challenge through shared volume
docker run -it --rm \
  -v jornal_certbot_www:/var/www/certbot \
  -v jornal_ssl_certs:/etc/letsencrypt/live \
  -v certbot_etc:/etc/letsencrypt \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "${DOMAIN}"

# Copy the newly issued cert files to the live volume location expected by Nginx
docker run --rm \
  -v jornal_ssl_certs:/etc/nginx/ssl/live \
  -v certbot_etc:/etc/letsencrypt \
  alpine sh -c "
    cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/nginx/ssl/live/fullchain.pem &&
    cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/nginx/ssl/live/privkey.pem &&
    chmod 600 /etc/nginx/ssl/live/privkey.pem
  "

echo "Reloading Nginx with new certificate..."
docker compose exec frontend nginx -s reload

echo "=== Success! Official Let's Encrypt TLS certificate active for https://${DOMAIN} ==="
