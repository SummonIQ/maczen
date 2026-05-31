# MacZen Monorepo

A modern, adaptive screenshot and screen recording organizer with desktop (Electron) and web (Next.js) interfaces.

## Features

- 🎨 **Adaptive Theme** - Automatically matches your system's dark/light mode
- 📸 **Screenshot Detection** - Automatically finds screenshots on your desktop
- 🎥 **Video Recording Support** - Detects and organizes screen recordings with thumbnail generation
- 📁 **Project Organization** - Quickly move files to project folders
- ⚡ **Modern UI** - Built with React, TypeScript, and Tailwind CSS
- 🖥️ **Native Performance** - Powered by Electron for native desktop experience

## Project Structure

This is a monorepo containing multiple applications:

```
maczen/
├── desktop/          # Desktop app (Electron + React + Vite)
├── web/              # Web app (Next.js 15 canary + Tailwind v4)
├── packages/         # Shared packages (future)
├── package.json      # Workspace configuration
└── tsconfig.json     # Base TypeScript config
```

### Apps

#### 🖥️ Electron Desktop App (`desktop/`)

- Built with Electron, React, and Vite
- Uses Tailwind CSS v3
- Automatically scans and organizes screenshots
- See [desktop/README.md](desktop/README.md) for details

#### 🌐 Next.js Web App (`web/`)

- Built with Next.js 15 canary
- Uses Tailwind CSS v4 with modern oklch colors
- Modern web interface for screenshot management
- See [web/README.md](web/README.md) for details

## Prerequisites

- Bun (recommended) or Node.js 18+
- ffmpeg (for video thumbnail generation in Electron app)

Install ffmpeg on macOS:

```bash
brew install ffmpeg
```

## Installation

Install all workspace dependencies:

```bash
bun install
```

## Development

### Run all apps:

```bash
bun run dev
```

### Run specific app:

```bash
# Electron app
bun run electron:dev

# Web app
bun run web:dev
```

### Other commands:

```bash
# Type check all apps
bun run typecheck

# Build all apps
bun run build

# Lint all apps
bun run lint
```

## How It Works

1. **File Scanning**: The app scans your Desktop for files starting with "Screenshot" or "Screen Recording"
2. **Thumbnail Generation**:
   - Images are loaded directly
   - Videos use ffmpeg to generate thumbnails from the first frame
3. **Organization**: Files can be moved to project folders with a single click
4. **Theme Detection**: Uses Electron's `nativeTheme` API to detect system theme changes

## IPC Communication

The app uses Electron's IPC (Inter-Process Communication) for secure communication between the renderer and main process:

- `get-theme` - Get current system theme
- `scan-files` - Scan desktop for screenshots and recordings
- `get-projects` - Get list of existing project folders
- `move-file` - Move a file to a project folder
- `generate-video-thumbnail` - Generate thumbnail for video files
- `get-file-data-url` - Get file as data URL for preview

## Technologies

- **Electron** - Desktop app framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Modern icon library

## Documentation

📚 **Comprehensive guides available**:

- **[CLAUDE.md](CLAUDE.md)** - Complete architecture, features, and coding patterns
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Developer guide with common tasks and patterns
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current state, recent changes, known issues
- **[QUICKSTART.md](QUICKSTART.md)** - Quick setup and usage guide

## Recent Updates

### Performance Improvements

- ✅ **5-minute thumbnail caching** - 95% faster repeated views
- ✅ **Smart dropdown positioning** - Opens upward when near screen edge
- ✅ **Event bubbling fixes** - Improved click handling in nested elements
- ✅ **Video thumbnail reliability** - Better FFmpeg error handling with timeout

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed changelog.

## License

MIT
