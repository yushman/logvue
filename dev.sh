#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# Helper to wait for backend
wait_for_backend() {
  for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
      echo "Backend ready!"
      return 0
    fi
    sleep 1
  done
  echo "Backend failed to start"
  return 1
}

# Stop existing servers
stop_servers() {
  echo "Stopping existing servers..."
  pkill -f "gradlew.*backend:run" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  sleep 1
}

# Frontend build
frontend_build() {
  echo "Building frontend..."
  cd "$SCRIPT_DIR/frontend"
  npm run build
}

# Frontend run (foreground)
frontend_run() {
  echo "Starting frontend (Vite)..."
  cd "$SCRIPT_DIR/frontend"
  npm run dev
}

# Backend build
backend_build() {
  echo "Building backend..."
  cd "$SCRIPT_DIR"
  ./gradlew :backend:build
}

# Backend run (background)
backend_run() {
  echo "Starting backend (Ktor)..."
  (
    cd "$SCRIPT_DIR"
    ./gradlew :backend:run 2>&1
  ) | tee "$LOG_DIR/backend.log" &
  wait_for_backend
  echo "Backend running. Logs: $LOG_DIR/backend.log"
}

# Full start
full_start() {
  stop_servers
  backend_run
  frontend_run
}

# Main command parsing
case "$1" in
  "f")
    frontend_run
    ;;
  "b")
    backend_run
    ;;
  "fbuild")
    frontend_build
    ;;
  "bbuild")
    backend_build
    ;;
  "stop")
    stop_servers
    echo "All servers stopped"
    ;;
  *)
    if [ -z "$1" ]; then
      full_start
    else
      echo "Usage: $0 [f|b|fbuild|bbuild|stop]"
      echo "  (no args) - start both (backend bg, frontend fg)"
      echo "  f - run frontend (foreground)"
      echo "  b - run backend (background)"
      echo "  fbuild - build frontend"
      echo "  bbuild - build backend"
      echo "  stop - stop all servers"
    fi
    ;;
esac
