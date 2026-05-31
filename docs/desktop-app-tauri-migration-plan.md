# MacZen Desktop App: Electron → Tauri Migration Plan

## Executive Summary

This plan outlines migrating the MacZen desktop app from Electron to Tauri while **keeping the existing Electron app intact**. The migration will follow patterns established in **Winzen** and **Snoopi** (both in `~/Projects`), emphasize **native macOS bridge** usage for performance-critical paths, and prioritize startup time, memory footprint, and responsiveness.

---

## 1. Current State Audit

### 1.1 MacZen Desktop App Architecture (Electron)

| Component | Location | Notes |
|----------|----------|-------|
| **Main process** | `apps/desktop-app/electron/main.ts` | ~6,000+ lines; IPC handlers, tray, window management |
| **Preload** | `electron/preload.ts` | Exposes `electronAPI` via contextBridge |
| **Renderer** | `src/` | React + Vite + Tailwind; App.tsx, ListView, GalleryView, FileCard, CaptureMode |
| **Native helpers** | `electron/photokit-thumbnailer.swift`, `electron/media-ocr.swift` | Swift CLI binaries; run via `execFile` |
| **PhotoKit helper** | `electron/photokit/photokit-thumbnailer` | Compiled .app wrapper for PhotoKit access |
| **Build** | `electron-builder` | Bundles Swift helpers in `extraResources` |

### 1.2 IPC Surface (Electron → Tauri Command Mapping)

**Theme & Profiling**

| IPC Channel | Purpose | Tauri Approach |
|-------------|---------|----------------|
| `get-theme` | System dark/light theme | Tauri plugin or Rust `native_theme` |
| `get-profiling-status`, `capture-profiling-snapshot`, etc. | Dev profiling | Optional; can defer or use Tauri's built-in logging |

**Intelligence / AI**

| IPC Channel | Purpose | Tauri Approach |
|-------------|---------|----------------|
| `get-intelligence-status`, `list-intelligence-jobs` | AI indexing status | Rust command + SQLite (intelligence-store equivalent) |
| `search-intelligence-media` | Semantic search | Rust command; SQLite FTS or external |
| `rebuild-intelligence-metadata`, `retry-failed-intelligence-ocr` | Rebuild/retry jobs | Rust command |

**Library & Albums**

| IPC Channel | Purpose | Tauri Approach |
|-------------|---------|----------------|
| `scan-files`, `scan-organized-files` | Scan desktop/organized folders | Rust `fs` commands; consider `walkdir` or similar |
| `get-albums`, `create-album`, `delete-album`, `rename-album` | Album CRUD | Rust command + filesystem |
| `get-apple-photos-albums`, `get-apple-photos-album-assets` | Apple Photos metadata | **Native bridge** (Swift) |
| `import-apple-photos` | Import from Photos | **Native bridge** (Swift PhotoKit) |
| `on-apple-photos-import-progress` | Progress events | Tauri events (`emit`) |

**Files & Thumbnails**

| IPC Channel | Purpose | Tauri Approach |
|-------------|---------|----------------|
| `get-file-data-url`, `get-video-playback-url`, `get-live-photo-video-url` | Media previews | Rust + FFI or native bridge for video/Photos |
| `generate-video-thumbnail` | Video thumbnails | Native bridge (AVFoundation) or Rust `ffmpeg` crate |
| `move-file`, `undo-move-file` | File operations | Rust `fs` |
| `delete-file`, `rename-file`, `reveal-in-finder` | File ops | Tauri `fs` + `shell` plugins |
| `auto-organize`, `cancel-auto-organize`, `on-auto-organize-progress` | AI organize | Rust command + Tauri events |

**Settings & System**

| IPC Channel | Purpose | Tauri Approach |
|-------------|---------|----------------|
| `get-settings`, `update-settings` | App settings | Tauri store or SQLite |
| `select-directory` | Folder picker | `tauri-plugin-dialog` |
| `request-photos-access` | Permission prompt | Native bridge (Swift) |
| `minimize-window`, `close-window`, `hide-window`, `show-window` | Window controls | Tauri `window` API |
| `capture-fullscreen-screenshot`, `capture-area-screenshot` | Screenshot capture | **Rust** (Snoopi: `screenshots` crate) or native bridge |
| `capture-fullscreen-video`, `capture-area-video`, `stop-video-recording`, `is-recording` | Screen recording | Native bridge (AVFoundation) |
| `get-license`, `activate-license`, `deactivate-license`, `open-upgrade-url` | License | `tauri-plugin-keychain` + HTTP |

### 1.3 Native macOS Dependencies (Critical Paths)

| Component | Current (Electron) | Migration Strategy |
|-----------|--------------------|--------------------|
| **PhotoKit thumbnailer** | Swift CLI `photokit-thumbnailer`; `execFile` | **MacZenBridge** Swift CLI (like Winzen’s `WinzenBridgeCLI`) |
| **PhotoKit list/import/export** | Same Swift helper | Extend MacZenBridge with list/album/export commands |
| **Media OCR** | `media-ocr.swift`; `execFile` | Extend MacZenBridge with OCR command (Vision framework) |
| **Video thumbnails** | PhotoKit helper or fallback | MacZenBridge (AVFoundation) |
| **Screen capture** | `desktopCapturer` | Rust `screenshots` crate (Snoopi) or native bridge |
| **Screen recording** | `desktopCapturer` + MediaRecorder | Native bridge (AVFoundation) |

---

## 2. Reference Implementations

### 2.1 Winzen (`~/Projects/winzen`)

- **`desktop-app-tauri/`**: Tauri 2 shell
- **`macos-bridge/`**: Swift Package (`WinzenBridgeCLI`) — JSON-over-stdin bridge
  - `BridgeServer.swift`: Reads JSON lines from stdin, routes to `BridgeCommandRouter`
  - `ScreenshotCommands.swift`: `CGDisplayCreateImage`, `CGWindowListCreateImage` (native screenshots)
  - `SpacesCommands.swift`, `WindowCommands.swift`, `PermissionCommands.swift`
- **`scripts/stage-native-bridge.mjs`**: Builds Swift bridge, copies binary to `desktop-app-tauri/src-tauri/binaries/`
- **Tauri `lib.rs`**: Single `native_bridge_invoke` command; spawns `WinzenBridgeCLI` as subprocess, passes JSON, parses response
- **Frontend**: `tauriBridge.ts` + `electronApiShim.ts` — shim layer so UI uses same `electronAPI`-style interface

**Pattern**: Tauri → Rust `native_bridge_invoke` → Swift CLI (stdin/stdout) → JSON request/response.

### 2.2 Snoopi (`~/Projects/snoopi`)

- **`desktop-app-tauri/`**: Tauri 2 shell with **Rust-native** commands
- **`src-tauri/src/screen_commands.rs`**: Uses `screenshots` crate; no Swift subprocess
  - `list_screen_sources`, `capture_screenshot`, `capture_menubar_screenshot`, `capture_active_display_screenshots`
- **`storage_commands.rs`**: File I/O, media recording
- **`active_window_commands.rs`**: AppleScript via `run_apple_script` for active window
- **`src/tauri-electron-shim.ts`**: Full `electronAPI`-style object; uses `invoke()` for Tauri commands
- **Plugins**: `tauri-plugin-keychain`, `tauri-plugin-dialog`, `tauri-plugin-notification`, `tauri-plugin-opener`

**Pattern**: Direct Rust commands where possible; AppleScript for macOS-specific (e.g. active window).

---

## 3. Recommended Architecture for MacZen Tauri

### 3.1 Hybrid: Rust + Native Bridge

**Use Rust directly for:**

- File system (scan, move, delete, rename)
- Settings persistence (e.g. JSON file or SQLite)
- Window controls (Tauri APIs)
- Screenshot capture (Snoopi’s `screenshots` crate)
- Dialog (folder picker)
- Keychain (license)

**Use Swift MacZenBridge for:**

- PhotoKit thumbnails, list albums, list assets
- Apple Photos import/export
- Media OCR (Vision framework)
- Video thumbnails (AVFoundation)
- Screen recording (AVFoundation)
- Permission checks (Photos, Screen Recording)

### 3.2 Directory Layout

```
maczen/
├── apps/
│   ├── desktop-app/           # KEEP — Electron (unchanged)
│   └── desktop-app-tauri/    # NEW — Tauri
│       ├── src/
│       │   ├── shell-bridge/  # electronApiShim.ts, tauriBridge.ts
│       │   ├── App.tsx        # Shared or symlinked from desktop-app
│       │   └── ...
│       └── src-tauri/
│           ├── src/
│           │   ├── lib.rs
│           │   ├── native_bridge.rs   # native_bridge_invoke
│           │   ├── fs_commands.rs
│           │   ├── screenshot_commands.rs  # screenshots crate
│           │   └── ...
│           ├── binaries/      # MacZenBridgeCLI-{target}
│           └── tauri.conf.json
├── macos-bridge/             # NEW — Swift Package (like Winzen)
│   ├── Package.swift
│   └── Sources/
│       └── MacZenBridgeCore/
│           ├── BridgeServer.swift
│           ├── BridgeCommandRouter.swift
│           ├── BridgeRequest.swift
│           ├── BridgeResponse.swift
│           ├── PhotoKitCommands.swift      # thumbnail, list, import, export
│           ├── MediaOcrCommands.swift      # Vision OCR
│           ├── VideoThumbnailCommands.swift # AVFoundation
│           └── ScreenRecordingCommands.swift
└── scripts/
    └── stage-native-bridge.mjs  # Build Swift, copy to binaries/
```

---

## 4. Migration Phases

### Phase 1: Project Scaffolding (Week 1)

1. **Create `macos-bridge/`** (Swift Package)
   - `BridgeServer`, `BridgeRequest`, `BridgeResponse`, `BridgeCommandRouter`
   - Stub commands: `bridge.health`, `photokit.thumbnail`, `photokit.list`, `media.ocr`, etc.
   - Port logic from `photokit-thumbnailer.swift` and `media-ocr.swift` into router handlers

2. **Create `apps/desktop-app-tauri/`**
   - `tauri init` (or copy from Winzen)
   - `tauri.conf.json`: `externalBin: ["binaries/MacZenBridgeCLI"]`
   - `native_bridge_invoke` in Rust (copy/adapt from Winzen)
   - `scripts/stage-native-bridge.mjs` — build Swift, copy to `src-tauri/binaries/`

3. **Vite + React setup**
   - Mirror `desktop-app`’s `vite.config.ts`, Tailwind, structure
   - `beforeDevCommand`: `bun run web:dev` (or equivalent)

### Phase 2: Shell Bridge & Core Commands (Weeks 2–3)

4. **`tauriBridge.ts` + `electronApiShim.ts`**
   - `createTauriDesktopBridge()` — `invokeBridge(command, payload)`
   - `installElectronApiShim()` — populate `window.electronAPI` with Tauri equivalents

5. **Rust commands**
   - `fs_commands`: `scan_files`, `scan_organized`, `move_file`, `delete_file`, `rename_file`, `reveal_in_finder`
   - `screenshot_commands`: `capture_fullscreen`, `capture_area` (use `screenshots` crate or defer to bridge)
   - `settings_commands`: `get_settings`, `update_settings`
   - `window_commands`: `minimize`, `close`, `hide`, `show`

6. **MacZenBridge commands**
   - `photokit.thumbnail` — port from `photokit-thumbnailer.swift`
   - `photokit.list`, `photokit.list_albums`, `photokit.list_album_assets`
   - `photokit.import` — import from Apple Photos
   - `media.ocr` — port from `media-ocr.swift`
   - `media.video_thumbnail` — AVFoundation

### Phase 3: Frontend Integration (Weeks 4–5)

7. **Shared frontend**
   - Option A: Copy `src/` into `desktop-app-tauri` and point all API calls through `electronAPI` (shim)
   - Option B: Shared package (`packages/desktop-ui`) consumed by both Electron and Tauri
   - Recommend Option A initially for speed; refactor to shared package later if needed

8. **Event handling**
   - `onApplePhotosImportProgress` → Tauri `listen('apple-photos-import-progress', ...)`
   - `onAutoOrganizeProgress`, `onAutoOrganizeError` → Tauri events
   - `onThemeChanged` → Tauri or Rust `native_theme`

### Phase 4: Capture Mode & Recording (Weeks 6–7)

9. **Screenshot capture**
   - Implement in Rust (`screenshots` crate) for fullscreen/area, or route to MacZenBridge if area selection needs native UI

10. **Screen recording**
    - MacZenBridge: `screens.record_start`, `screens.record_stop` — AVFoundation `AVCaptureSession`
    - Tauri events for progress/completion

### Phase 5: Intelligence, License, Polish (Weeks 8–10)

11. **Intelligence store**
    - Port `intelligence-store.ts` to Rust (SQLite) or keep TypeScript in a separate process (heavier)
    - Prefer Rust SQLite + FTS for search

12. **License**
    - `tauri-plugin-keychain` for activation key storage
    - HTTP calls for license validation (same as Electron)

13. **Testing & validation**
    - Playwright for Tauri (e.g. `@tauri-apps/plugin-automation` or similar)
    - Parity checks: scan, import, organize, capture, settings

---

## 5. Native Bridge Command Spec (MacZenBridge)

### 5.1 Request/Response Format (JSON lines over stdin/stdout)

```json
// Request
{"id":"req-1","command":"photokit.thumbnail","payload":{"localIdentifier":"ABC123","size":360,"quality":0.7}}

// Response
{"id":"req-1","success":true,"data":{"dataUrl":"data:image/jpeg;base64,..."},"timing_ms":45}
```

### 5.2 Commands to Implement

| Command | Payload | Response |
|---------|---------|----------|
| `bridge.health` | `{}` | `{status, version}` |
| `photokit.thumbnail` | `{localIdentifier, size?, quality?}` | `{dataUrl}` |
| `photokit.list` | `{lookbackDays?, importAll?}` | `{items: [...]}` |
| `photokit.list_albums` | `{}` | `{albums: [...]}` |
| `photokit.list_album_assets` | `{albumId}` | `{assets: [...]}` |
| `photokit.import` | `{force?}` | `{started: true}` + progress events via... (see below) |
| `photokit.live_video` | `{localIdentifier}` | `{url}` (file://) |
| `photokit.export` | `{resourceId, outDir}` | `{path}` |
| `media.ocr` | `{filePath}` | `{text, lineCount}` |
| `media.video_thumbnail` | `{filePath}` | `{dataUrl}` |
| `screens.record_start` | `{fullScreen?}` | `{sessionId}` |
| `screens.record_stop` | `{sessionId}` | `{path}` |
| `permissions.photos` | `{}` | `{granted}` |
| `permissions.screen_recording` | `{}` | `{granted}` |

**Progress for `photokit.import`**: Bridge cannot push to Tauri easily. Options:
- **A**: Tauri polls a temp file or IPC that bridge writes to
- **B**: Bridge writes progress to a named pipe; Rust reads and emits Tauri events
- **C**: Bridge runs as long-lived process; Tauri keeps pipe open and reads progress lines

Recommend **C** for import: single long-running bridge process for import, streaming JSON lines.

---

## 6. Performance Optimizations

### 6.1 Startup

- Tauri: ~10–50 MB baseline vs Electron ~150+ MB
- Lazy-load heavy modules (intelligence, OCR) after first paint
- Defer PhotoKit bridge spawn until first Photos operation

### 6.2 Memory

- Rust commands: no V8/Node; lower baseline
- Thumbnail cache: same strategy as Electron (file-based); consider `tauri-plugin-store` or SQLite
- Limit in-flight OCR/bridge requests (e.g. semaphore in Rust)

### 6.3 Responsiveness

- Use `spawn_blocking` in Rust for file/network I/O (like Snoopi)
- Run MacZenBridge in parallel for batch thumbnails (e.g. 4 concurrent)
- Consider keeping a small pool of bridge processes for import/OCR if needed

### 6.4 Native APIs Preference

- Screenshots: Rust `screenshots` crate (no subprocess)
- File I/O: Rust `tokio::fs` or `std::fs`
- Photos/OCR/Video/Recording: Swift MacZenBridge (best macOS integration)

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Electron app regressions | Keep Electron app; no changes to `desktop-app` |
| Bridge binary size | Ship only for `aarch64-apple-darwin` initially; add x86_64 if needed |
| PhotoKit edge cases | Preserve fallback to Photos database/SQL queries if bridge fails |
| Screen recording sandbox | `macOSPrivateApi: true` in tauri.conf; document entitlements |
| License/Stripe | Same backend; only storage (keychain) differs |

---

## 8. Success Criteria

- [ ] Tauri app builds and runs on macOS
- [ ] Feature parity: scan, organize, Albums, Apple Photos import, capture, recording
- [ ] Startup time < 2 s (vs ~3–5 s Electron)
- [ ] Memory footprint < 80 MB idle (vs ~150+ MB Electron)
- [ ] No behavioral changes to existing Electron app
- [ ] Playwright (or equivalent) tests cover main flows

---

## 9. References

- **Winzen** `~/Projects/winzen`: `macos-bridge/`, `desktop-app-tauri/`, `stage-native-bridge.mjs`
- **Snoopi** `~/Projects/snoopi`: `desktop-app-tauri/src-tauri/`, `tauri-electron-shim.ts`, `screen_commands.rs`
- Tauri 2 docs: [tauri.app](https://tauri.app)
- `screenshots` crate: [crates.io/crates/screenshots](https://crates.io/crates/screenshots)
