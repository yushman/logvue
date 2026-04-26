#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
ASSETS_DIR="$SCRIPT_DIR/backend/assets"

# Clean only the assets subdirectory before build
rm -rf "$ASSETS_DIR/assets"
cd "$FRONTEND_DIR"
npm run build
