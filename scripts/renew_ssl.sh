#!/usr/bin/env bash
set -e

# ==============================================================================
# Automated Let's Encrypt Certificate Renewal for Jornal AI / MindLog AI
# Safe for cron jobs and manual execution.
# Only renews if certificates expire within 30 days (default Certbot behavior).
#
# Recommended cron setup (runs every Monday at 03:00 UTC):
# 0 3 * * 1 /bin/bash /path/to/jornalAI_5TWIN5_ErrorList/scripts/renew_ssl.sh >> /var/log/mindlog_ssl_renew.log 2>&1
# ==============================================================================

DEFAULT_DOMAIN="mindlog-ai.swedencentral.cloudapp.azure.com"
DOMAIN="${1:-${DEFAULT_DOMAIN}}"
CONTAINER_NAME="jornal_frontend"

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Starting certificate renewal check for ${DOMAIN}..."

# Check that Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "Error: 'docker' command not found. Aborting renewal." >&2
  exit 1
fi

# Check that frontend container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Error: Container '${CONTAINER_NAME}' is not running. Aborting renewal." >&2
  exit 1
fi

WEBROOT_VOL="jornal_certbot_www"
CERTBOT_ETC_VOL="jornal_certbot_etc"
NGINX_SSL_VOL="jornal_ssl_certs"

# Run certbot renew (Certbot automatically checks expiration date and only renews if <= 30 days remain)
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Running Certbot renew..."
docker run --rm \
  -v "${WEBROOT_VOL}:/var/www/certbot" \
  -v "${CERTBOT_ETC_VOL}:/etc/letsencrypt" \
  certbot/certbot renew \
  --webroot \
  --webroot-path=/var/www/certbot \
  --non-interactive

# Copy certificates into Nginx active volume with dereference (-L)
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Updating active Nginx certificates..."
docker run --rm \
  -v "${NGINX_SSL_VOL}:/etc/nginx/ssl/live" \
  -v "${CERTBOT_ETC_VOL}:/etc/letsencrypt" \
  alpine sh -c "
    if [ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ] && [ -f /etc/letsencrypt/live/${DOMAIN}/privkey.pem ]; then
      cp -L /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/nginx/ssl/live/fullchain.pem
      cp -L /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/nginx/ssl/live/privkey.pem
      chmod 644 /etc/nginx/ssl/live/fullchain.pem
      chmod 600 /etc/nginx/ssl/live/privkey.pem
      echo 'Certificates refreshed in Nginx volume.'
    fi
  "

# Reload Nginx
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Reloading Nginx..."
if docker exec "${CONTAINER_NAME}" nginx -s reload; then
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Nginx successfully reloaded with updated certificates."
else
  docker compose exec -T frontend nginx -s reload || true
fi

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Certificate renewal check completed successfully."
