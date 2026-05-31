# Development Guide - MacZen (Electron)

## New Machine Setup

### Prerequisites

1. **Node.js 18+**

   ```bash
   node --version  # Should be 18+
   ```

2. **FFmpeg** (Required for video thumbnails)

   ```bash
   brew install ffmpeg
   ffmpeg -version  # Verify installation
   ```

3. **OpenAI API Key** (Required for AI auto-organize feature)
   - Get key from: https://platform.openai.com/api-keys
   - Create `.env` file in `electron/` directory:
     ```
     OPENAI_API_KEY=sk-...
     ```

### Installation

```bash
cd electron
npm install  # or: bun install
```

### Running Development Server

```bash
npm start
```

This will:

- Start Vite dev server on http://localhost:30050
- Launch Electron with hot-reload
- Open DevTools automatically

## Project Structure

```
electron/
├── electron/                   # Main process (Node.js)
│   ├── main.ts                # Entry point, IPC handlers, caching
│   ├── preload.ts             # Context bridge for IPC
│   └── tsconfig.json
├── src/                       # Renderer process (React)
│   ├── components/
│   │   ├── FileCard.tsx       # Grid view card component
│   │   ├── ListView.tsx       # List view component
│   │   └── GalleryView.tsx    # Full-screen gallery
│   ├── App.tsx                # Main React component
│   ├── main.tsx               # React entry point
│   ├── types.ts               # TypeScript interfaces
│   └── index.css              # Global styles + Tailwind
├── dist/                      # Compiled output (gitignored)
├── release/                   # Built Electron apps (gitignored)
├── .env                       # Environment variables (gitignored)
└── package.json               # Dependencies and scripts
```

## Key Files to Understand

### 1. `electron/main.ts` (Main Process)

**Critical Systems**:

- **Thumbnail cache**: 5-minute in-memory cache for images/videos
- **IPC handlers**: All backend operations (file scanning, moving, AI)
- **FFmpeg integration**: Video thumbnail generation
- **OpenAI integration**: AI auto-organization

**Key IPC Handlers**:

- `scan-files`: Scans Desktop for screenshots/recordings
- `generate-video-thumbnail`: Creates video thumbnails with caching
- `get-file-data-url`: Loads images with caching
- `move-file`: Organizes files into project folders
- `auto-organize`: AI-powered file organization
- `get-theme`: System theme detection
- `minimize-window`, `close-window`: Window controls

### 2. `src/App.tsx` (Main React Component)

**State Management**:

- View mode: grid, list, or gallery
- File filtering: all, screenshots, or recordings
- Gallery index for full-screen view
- Auto-refresh: 30s focused, 2min unfocused
- AI suggestions modal

**View Rendering Logic**:

- Grid: FileCard components in responsive grid
- List: ListView component with click-to-gallery
- Gallery: GalleryView full-screen overlay

### 3. `src/components/FileCard.tsx`

**Features**:

- Lazy loading with IntersectionObserver
- Smart dropdown positioning (opens up if near bottom)
- Event propagation prevention (critical for gallery mode)
- Memoized for performance

### 4. `src/components/ListView.tsx`

**Features**:

- Compact table layout
- Same smart positioning as FileCard
- Click-through to gallery via data attributes

### 5. `src/components/GalleryView.tsx`

**Features**:

- Full-screen image viewer
- Keyboard navigation (arrows, Esc)
- Move dropdown always opens upward
- Smooth loading states

## Common Development Tasks

### Adding a New IPC Handler

**1. Define in `electron/main.ts`:**

```typescript
ipcMain.handle("my-new-handler", async (_event, arg1, arg2) => {
  try {
    // Process
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
```

**2. Add to `electron/preload.ts`:**

```typescript
contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing methods
  myNewMethod: (arg1, arg2) => ipcRenderer.invoke("my-new-handler", arg1, arg2),
});
```

**3. Add TypeScript definition in `src/types.ts`:**

```typescript
interface ElectronAPI {
  // ... existing methods
  myNewMethod: (arg1: Type1, arg2: Type2) => Promise<Result>;
}
```

**4. Use in React:**

```typescript
const result = await window.electronAPI.myNewMethod(arg1, arg2);
```

### Adding a New Component

**1. Create file in `src/components/`:**

```tsx
import { useState } from "react";
import clsx from "clsx";

interface MyComponentProps {
  prop1: string;
  theme: "dark" | "light";
}

export default function MyComponent({ prop1, theme }: MyComponentProps) {
  const isDark = theme === "dark";

  return (
    <div
      className={clsx(
        "base-classes",
        isDark ? "dark-classes" : "light-classes"
      )}
    >
      {/* Content */}
    </div>
  );
}
```

**2. Import in parent component:**

```tsx
import MyComponent from "./components/MyComponent";
```

### Modifying File Organization Logic

The file organization happens in `electron/main.ts` in the `move-file` handler.

**Target structure**:

```
~/Documents/Screenshots/
└── [ProjectName]/
    ├── Screenshots/
    └── Recordings/
```

**Key functions**:

- `fs.mkdir(dir, { recursive: true })`: Creates directories
- `fs.rename(source, dest)`: Moves file atomically
- Duplicate handling: Appends `_1`, `_2`, etc.

### Adding Caching for New Operations

Follow the pattern in `generate-video-thumbnail`:

```typescript
// 1. Check cache
const cached = thumbnailCache.get(key);
if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
  return cached.data;
}

// 2. Perform operation
const result = await expensiveOperation();

// 3. Store in cache
thumbnailCache.set(key, {
  data: result,
  timestamp: Date.now(),
});

// 4. Return result
return result;
```

**Don't forget**: Invalidate cache when data changes (e.g., on file move).

## Debugging Tips

### Main Process Issues

**View logs**: Check the terminal where `npm start` is running

**Common issues**:

- FFmpeg not found: `brew install ffmpeg`
- IPC handler not registered: Check `ipcMain.handle()` is defined
- File not found errors: Add existence checks with `fs.access()`

### Renderer Process Issues

**View logs**: Open DevTools (automatically opens in dev mode)

**Common issues**:

- `window.electronAPI` undefined: Check preload script
- State not updating: Verify useState dependencies
- Props not passing: Check TypeScript interfaces match

### IPC Communication Issues

**Debug pattern**:

```typescript
// In renderer
console.log("Calling IPC:", method, args);
const result = await window.electronAPI.method(args);
console.log("IPC result:", result);

// In main
ipcMain.handle("method", async (_event, args) => {
  console.log("IPC received:", args);
  const result = await process(args);
  console.log("IPC returning:", result);
  return result;
});
```

### Performance Issues

**Check these**:

1. Is caching working? (Check cache hit logs)
2. Are too many thumbnails loading at once? (Check IntersectionObserver)
3. Is the component re-rendering unnecessarily? (Check React DevTools Profiler)
4. Is displayLimit too high? (Default: 20)

## Building for Production

### Development Build

```bash
npm run build
```

This compiles TypeScript and bundles with Vite.

### Production Electron App

```bash
npm run build:electron
```

Output: `release/MacZen.app`

**electron-builder configuration** in `package.json`:

- App ID: `com.screenshot.organizer`
- macOS category: Productivity
- Icon: `../AppIcon.icns`

## Testing

### Manual Testing Checklist

**File Detection**:

- [ ] Detects screenshots (.png, .jpg, .jpeg, .gif)
- [ ] Detects recordings (.mov, .mp4, .avi, .mkv)
- [ ] Ignores non-matching files

**Thumbnails**:

- [ ] Images load correctly
- [ ] Videos generate thumbnails (check FFmpeg)
- [ ] Thumbnails cached (second load instant)

**Views**:

- [ ] Grid view displays cards properly
- [ ] List view shows compact rows
- [ ] Gallery view opens on card click
- [ ] Gallery navigation (arrows, keyboard)

**File Organization**:

- [ ] Can move to existing project
- [ ] Can create new project
- [ ] Files move to correct directories
- [ ] Duplicate names handled correctly

**UI Interactions**:

- [ ] Dropdown opens without triggering gallery
- [ ] Dropdown positions correctly at screen edges
- [ ] Theme switches with system preference
- [ ] Window controls work (minimize, close)

**AI Features**:

- [ ] Auto-organize button triggers AI
- [ ] Suggestions modal displays
- [ ] Can accept/reject suggestions
- [ ] Files move after accepting

### Performance Testing

**Large file sets** (50+ files):

- Load time reasonable?
- Scrolling smooth?
- Memory usage acceptable?
- Cache working effectively?

## Common Pitfalls & Solutions

### 1. Event Bubbling in Nested Clickables

**Problem**: Child click triggers parent handler

**Solution**: Always use `e.stopPropagation()`

```tsx
<div onClick={parentHandler}>
  <button onClick={(e) => {
    e.stopPropagation(); // CRITICAL
    childHandler();
  }}>
</div>
```

### 2. Dropdown Cut Off by Screen Edge

**Problem**: Menu extends beyond viewport

**Solution**: Calculate available space and adjust position

```tsx
const rect = buttonRef.current.getBoundingClientRect();
const spaceBelow = window.innerHeight - rect.bottom;
const openUpward = spaceBelow < menuHeight;
```

### 3. Stale Thumbnails After File Operations

**Problem**: Cached thumbnail shown for moved file

**Solution**: Invalidate cache on file move

```typescript
await fs.rename(oldPath, newPath);
thumbnailCache.delete(oldPath); // Don't forget this!
```

### 4. FFmpeg Timeout on Large Videos

**Problem**: Video thumbnail generation hangs

**Solution**: Already implemented - 10-second timeout

```typescript
await execAsync(ffmpegCommand, { timeout: 10000 });
```

### 5. Memory Leaks from Cache

**Problem**: Cache grows indefinitely

**Solution**: Already implemented - automatic cleanup

```typescript
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}, 60000);
```

## Code Style Guidelines

### TypeScript

- Use interfaces for props and data structures
- Avoid `any` - use `unknown` or proper types
- Prefer `async/await` over promises
- Use optional chaining: `object?.property`

### React

- Functional components only (no classes)
- Use hooks: `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`
- Destructure props in function signature
- Memoize expensive computations with `useMemo`
- Memoize callbacks with `useCallback` when passed to children

### Styling

- Use Tailwind utility classes
- Use `clsx` for conditional classes
- Follow dark/light theme pattern: `isDark ? 'dark' : 'light'`
- Avoid inline styles (use Tailwind instead)

### File Organization

- One component per file
- Named exports for components
- Group related utilities in same file
- Keep components under 300 lines (extract if larger)

## Environment Variables

Create `.env` in `electron/` directory:

```bash
# OpenAI API Key (required for AI features)
OPENAI_API_KEY=sk-...

# Optional: Development mode override
NODE_ENV=development
```

**Security**: Never commit `.env` file (already in `.gitignore`)

## Port Configuration

- **Vite dev server**: 30050 (configured in `vite.config.ts`)
- **Electron**: Connects to Vite server in dev mode

To change port, update:

1. `vite.config.ts`: `server: { port: XXXX }`
2. `electron/main.ts`: `mainWindow.loadURL('http://localhost:XXXX')`
3. `package.json`: `wait-on http://localhost:XXXX`

## Resources

- [Electron Docs](https://www.electronjs.org/docs)
- [React 18 Docs](https://react.dev)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Getting Help

1. Check console logs (both main and renderer)
2. Review `electron/CLAUDE.md` for architectural details
3. Check this guide for common patterns
4. Search for error messages in terminal and DevTools
5. Verify FFmpeg is installed and in PATH
6. Ensure `.env` file exists with valid API key
