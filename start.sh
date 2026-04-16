#!/bin/bash
set -e

JAR_DIR="backend/build/libs"
JAR_FILE=$(ls $JAR_DIR/backend-0.1.0-all.jar 2>/dev/null || ls $JAR_DIR/backend-all.jar 2>/dev/null | head -1)

# Build if needed
if [ -z "$JAR_FILE" ]; then
    echo "Building..."
    make build
    JAR_FILE=$(ls $JAR_DIR/backend-0.1.0-all.jar 2>/dev/null || ls $JAR_DIR/backend-all.jar 2>/dev/null | head -1)
fi

if [ -z "$JAR_FILE" ]; then
    echo "JAR not found after build."
    exit 1
fi

# Kill existing process on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Start JAR
echo "Starting LogVue..."
java -jar "$JAR_FILE"