#!/bin/bash
set -e

cd "$(dirname "$0")/backend"

# Build if needed
if [ ! -f "./logvue" ]; then
    echo "Building..."
    go build -o logvue .
fi

# Kill existing process on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Start server
echo "Starting LogVue..."
./logvue start -p 8080
