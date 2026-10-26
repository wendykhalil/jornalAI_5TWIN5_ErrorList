#!/usr/bin/env bash
set -e

# ==============================================================================
# Setup Official Let's Encrypt TLS Certificate for Jornal AI / MindLog AI
# Uses the Certbot HTTP-01 challenge against the running Nginx container.
#
# Production domain: mindlog-ai.swedencentral.cloudapp.azure.com
# Target Azure VM IP: 20.240.53.98
# ==============================================================================

DEFAULT_DOMAIN="mindlog-ai.swedencentral.cloudapp.azure.com"

# Argument parsing:
# Usage:
#   sudo bash scripts/setup_ssl.sh <admin-email>
#   sudo bash scripts/setup_ssl.sh <domain-name> <admin-email>
if [ -z "$1" ]; then
  echo "Usage: $0 [domain-name] <admin-email> OR $0 <admin-email>"
  echo "Example: $0 admin@mindlog.ai"
  echo "Example: $0 mindlog-ai.swedencentral.cloudapp.azure.com admin@mindlog.ai"
  exit 1
fi

if [[ "$1" == *"@"* ]] && [ -z "$2" ]; then
  DOMAIN="${DEFAULT_DOMAIN}"
  EMAIL="$1"
else
  DOMAIN="$1"
  EMAIL="${2:-admin@mindlog.ai}"
fi

echo "================================================================="
echo "Requesting Let's Encrypt TLS Certificate"
echo "Domain: ${DOMAIN}"
echo "Email : ${EMAIL}"
echo "================================================================="

# Check that Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "Error: 'docker' command not found. Please ensure Docker is installed and in PATH." >&2
  exit 1
fi

# Determine frontend container name (defaults to jornal_frontend)
CONTAINER_NAME="jornal_frontend"
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Error: Container '${CONTAINER_NAME}' is not running." >&2
  echo "Please start the production stack first using: docker compose up -d" >&2
  exit 1
fi

# Detect TTY for docker run (safe for automated/sudo/SSH non-interactive execution)
DOCKER_FLAGS="--rm"
if [ -t 0 ] && [ -t 1 ]; then
  DOCKER_FLAGS="${DOCKER_FLAGS} -it"
else
  DOCKER_FLAGS="${DOCKER_FLAGS} -i"
fi

# Named volumes shared with docker-compose:
# - jornal_certbot_www: Webroot for HTTP-01 ACME challenge
# - jornal_certbot_etc: Certbot configuration, keys, and renewal records
# - jornal_ssl_certs: Nginx active certificate directory (/etc/nginx/ssl/live)
WEBROOT_VOL="jornal_certbot_www"
CERTBOT_ETC_VOL="jornal_certbot_etc"
NGINX_SSL_VOL="jornal_ssl_certs"

echo "1/3 Requesting certificate via Certbot HTTP-01 webroot challenge..."
# NOTE: We mount ONLY webroot and certbot_etc.
# No overlapping mounts into /etc/letsencrypt/live to avoid breaking Certbot's symlinks.
# Using --keep-until-expiring prevents burning Let's Encrypt rate limits on re-runs.
docker run ${DOCKER_FLAGS} \
  -v "${WEBROOT_VOL}:/var/www/certbot" \
  -v "${CERTBOT_ETC_VOL}:/etc/letsencrypt" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --keep-until-expiring \
  --non-interactive \
  -d "${DOMAIN}"

echo "2/3 Copying validated certificates into Nginx active volume..."
# We use cp -L (dereference) to copy the actual certificate files rather than relative symlinks,
# ensuring Nginx can read them directly without requiring the full /etc/letsencrypt directory.
docker run --rm \
  -v "${NGINX_SSL_VOL}:/etc/nginx/ssl/live" \
  -v "${CERTBOT_ETC_VOL}:/etc/letsencrypt" \
  alpine sh -c "
    if [ ! -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ] || [ ! -f /etc/letsencrypt/live/${DOMAIN}/privkey.pem ]; then
      echo 'Error: Certificate files not found in /etc/letsencrypt/live/${DOMAIN}/' >&2
      exit 1
    fi
    cp -L /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/nginx/ssl/live/fullchain.pem
    cp -L /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/nginx/ssl/live/privkey.pem
    chmod 644 /etc/nginx/ssl/live/fullchain.pem
    chmod 600 /etc/nginx/ssl/live/privkey.pem
    echo 'Certificates successfully updated in Nginx live volume.'
  "

echo "3/3 Reloading Nginx with new certificate..."
if docker exec "${CONTAINER_NAME}" nginx -s reload; then
  echo "Nginx successfully reloaded!"
else
  echo "Fallback: Reloading via docker compose exec..."
  docker compose exec -T frontend nginx -s reload
fi

echo "================================================================="
echo "SUCCESS! Official Let's Encrypt certificate active for:"
echo "https://${DOMAIN}"
echo "================================================================="
