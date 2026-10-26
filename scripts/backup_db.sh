#!/usr/bin/env bash
set -e

# ==============================================================================
# Automated MariaDB Database Backup Script
# Creates a compressed timestamped .sql.gz backup from the running container.
# Keeps the last 14 backups and prunes older ones.
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/jornal_ai_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="jornal_db"

mkdir -p "${BACKUP_DIR}"

echo "Starting database backup at ${TIMESTAMP}..."

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Error: Container '${CONTAINER_NAME}' is not running."
  exit 1
fi

# Load DB credentials from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_NAME="${DB_NAME:-jornal_ai}"
DB_USER="${DB_USER:-jornal_user}"
DB_PASSWORD="${DB_PASSWORD}"

docker exec "${CONTAINER_NAME}" \
  mariadb-dump \
  -u "${DB_USER}" \
  -p"${DB_PASSWORD}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "Backup completed successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than 14 days
echo "Cleaning up backups older than 14 days..."
find "${BACKUP_DIR}" -type f -name "jornal_ai_backup_*.sql.gz" -mtime +14 -delete
echo "Done!"
