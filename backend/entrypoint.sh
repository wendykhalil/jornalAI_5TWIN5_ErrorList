#!/bin/sh
set -e

echo "=== Jornal AI Backend Initializing ==="

# Wait for MariaDB database to be ready
echo "Waiting for MariaDB at ${DB_HOST:-db}:${DB_PORT:-3306}..."
while ! nc -z "${DB_HOST:-db}" "${DB_PORT:-3306}"; do
  sleep 1
done
echo "MariaDB is ready!"

# Run database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files for Nginx
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start Gunicorn server
# Calibrated for 4 vCPU / 16 GB RAM Azure VM:
# 2 workers with 2 threads per worker + 300s timeout for CPU AI inference
echo "Starting Gunicorn server on 0.0.0.0:8000..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-300}" \
  --access-logfile - \
  --error-logfile -
