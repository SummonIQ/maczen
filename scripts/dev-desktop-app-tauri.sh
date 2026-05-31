#!/bin/bash

set -euo pipefail

TAURI_BIN_MATCH="target/debug/maczen-desktop-tauri"

echo "🧹 Ensuring no existing desktop-app-tauri instances are running..."
pkill -f "$TAURI_BIN_MATCH" 2>/dev/null || true
pkill -f "tauri dev --no-dev-server" 2>/dev/null || true
pkill -f "concurrently -k \"bun run web:dev\" \"tauri dev --no-dev-server\"" 2>/dev/null || true

if lsof -ti:30232 >/dev/null 2>&1; then
  echo "🧹 Clearing process on port 30232..."
  lsof -ti:30232 | xargs kill -9 2>/dev/null || true
fi

sleep 0.5

bunx turbo run tauri:dev --filter='@maczen/desktop-app-tauri'
