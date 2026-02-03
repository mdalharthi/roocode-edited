#!/bin/bash
# Start the backend API server with conda environment

# Activate conda environment
source /opt/miniconda3/bin/activate code-assistant-backend

# Navigate to backend directory
cd "$(dirname "$0")"

# Unset system DATABASE_URL to ensure .env file is used
unset DATABASE_URL

# Start uvicorn server
echo "Starting Code Assistant Backend API..."
echo "Environment: code-assistant-backend"
echo "Note: Using DATABASE_URL from .env file"
echo "URL: http://localhost:8000"
echo "Docs: http://localhost:8000/docs"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
