#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend-go"
cd "$BACKEND_DIR"

BINARY="./logvue"
CMD="${1:-run}"

build() {
    echo "Building..."
    go build -o logvue .
    echo "Built."
}

case "$CMD" in
    run)
        if [ ! -f "$BINARY" ]; then
            build
        fi
        ./logvue start -p 8080
        ;;
    build)
        build
        ;;
    *)
        build
        ./logvue start -p 8080
        ;;
esac
