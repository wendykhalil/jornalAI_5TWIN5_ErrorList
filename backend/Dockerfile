FROM python:3.11-slim-bookworm

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app/backend

# Install required system dependencies:
# - ffmpeg: audio decoding and PyAV backend for faster-whisper
# - tesseract-ocr, tesseract-ocr-fra, tesseract-ocr-eng: OCR engine for mood module
# - poppler-utils: pdftoppm utility for scanned PDF extraction
# - default-libmysqlclient-dev, pkg-config, gcc: compilation of mysqlclient
# - netcat-openbsd, curl: connectivity checks and container health
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-eng \
    poppler-utils \
    default-libmysqlclient-dev \
    pkg-config \
    gcc \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt /app/backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY . /app/backend/

# Make entrypoint script executable
RUN chmod +x /app/backend/entrypoint.sh

# Expose Gunicorn port
EXPOSE 8000

ENTRYPOINT ["/app/backend/entrypoint.sh"]
