#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
  if [[ -n "${FRONT_PID:-}" ]] && kill -0 "$FRONT_PID" 2>/dev/null; then
    kill "$FRONT_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$FRONTEND_DIR"
pnpm install --frozen-lockfile
pnpm dev > /tmp/filebrowser-frontend.log 2>&1 &
FRONT_PID=$!

for _ in {1..60}; do
  if curl -sf http://127.0.0.1:3000 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cd "$ROOT_DIR"
FILEBROWSER_FRONTEND_URL=http://127.0.0.1:3000 go run .
