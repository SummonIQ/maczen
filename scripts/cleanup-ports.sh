#!/bin/bash
# MacZen Port Cleanup Script
# Only kills processes on MacZen-specific ports (30050, 30051, 30232)
# These ports are configured in:
#   - desktop-app/vite.config.ts (port 30050)
#   - marketing-site/package.json (port 30051)
#   - desktop-app-tauri/vite.config.ts (port 30232)

echo "🧹 Cleaning up MacZen ports (30050, 30051, 30232)..."

# Kill process on port 30050 (Electron/Vite dev server)
if lsof -ti:30050 >/dev/null 2>&1; then
  echo "   Killing process on port 30050 (desktop-app)..."
  lsof -ti:30050 | xargs kill -9 2>/dev/null || true
fi

# Kill process on port 30051 (Next.js marketing site)
if lsof -ti:30051 >/dev/null 2>&1; then
  echo "   Killing process on port 30051 (marketing-site)..."
  lsof -ti:30051 | xargs kill -9 2>/dev/null || true
fi

# Kill process on port 30232 (Tauri shell Vite dev server)
if lsof -ti:30232 >/dev/null 2>&1; then
  echo "   Killing process on port 30232 (desktop-app-tauri)..."
  lsof -ti:30232 | xargs kill -9 2>/dev/null || true
fi

echo "✅ MacZen ports cleaned up!"
