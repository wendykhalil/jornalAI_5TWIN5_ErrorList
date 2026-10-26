#!/usr/bin/env bash
set -e

# ==============================================================================
# Helper script to initialize required Ollama models on the Azure VM.
# Only downloads the exact models required by the application.
# ==============================================================================

CONTAINER_NAME="jornal_ollama"

echo "=== Checking Ollama Container Status ==="
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Error: Container '${CONTAINER_NAME}' is not running."
  echo "Please start the stack first using: docker compose up -d"
  exit 1
fi

echo "Ollama container is running. Initializing application models..."

# 1. Main LLM for Mood Analysis, Journal Assistant, Goals, Memories (qwen2.5:7b)
echo "--------------------------------------------------"
echo "1/3 Pulling main language model (qwen2.5:7b)..."
docker exec -it "${CONTAINER_NAME}" ollama pull qwen2.5:7b

# 2. Embedding Model for Semantic Search (nomic-embed-text:latest)
echo "--------------------------------------------------"
echo "2/3 Pulling embedding model (nomic-embed-text:latest)..."
docker exec -it "${CONTAINER_NAME}" ollama pull nomic-embed-text:latest

# 3. Vision Model for Journal Photos (llama3.2-vision:latest)
echo "--------------------------------------------------"
echo "3/3 Pulling vision model (llama3.2-vision:latest)..."
docker exec -it "${CONTAINER_NAME}" ollama pull llama3.2-vision:latest

echo "=================================================="
echo "Currently installed models in Ollama:"
docker exec -it "${CONTAINER_NAME}" ollama list
echo "=================================================="
echo "Ollama initialization complete! All application AI features are ready."
