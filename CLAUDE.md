# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AYA is an Electron desktop application that provides a GUI for ADB (Android Debug Bridge) to control Android devices. Built with TypeScript, React 19, MobX, and Vite.

## Commands

```bash
# Development (starts all watchers concurrently)
npm run dev

# Individual dev watchers
npm run dev:main        # Main process
npm run dev:preload     # Preload scripts
npm run dev:renderer    # Vite dev server for renderer

# Build
npm run build           # Full production build (runs script/build.mjs)
npm run build:main
npm run build:preload
npm run build:renderer

# Run the built app (with inspector)
npm run start

# Code quality
npm run lint            # ESLint
npm run format          # Prettier

# Code generation
npm run gen:icon        # Generate icon CSS from SVGs
npm run gen:theme       # Generate theme SCSS/TS from theme.json
npm run gen:pb          # Generate Protocol Buffer types from .proto files

# Packaging
npm run pack            # Package for current platform
npm run pack:mas        # macOS App Store
npm run pack:appx       # Windows AppX
```

## Architecture

### Electron Process Model

The app follows Electron's main-preload-renderer architecture with code split across four source directories:

- **`src/main/`** — Main process (Node.js). Manages windows, ADB device communication, file system ops, and IPC endpoints. ADB features are organized in `src/main/lib/adb/` (shell, cpu, fps, scrcpy, file, package, logcat, etc.).
- **`src/preload/`** — Preload scripts that bridge main and renderer via typed IPC.
- **`src/renderer/`** — React frontend. Contains multiple sub-apps for different windows:
  - `renderer/main/` — Primary app with tabbed UI (overview, applications, file explorer, shell, logcat, etc.)
  - `renderer/screencast/` — Screen mirroring window
  - `renderer/avd/` — Android Virtual Device manager window
  - `renderer/devices/` — Device manager window
- **`src/share/`** — Code shared across all processes (types, i18n, utilities, shared components/stores, additional window UIs like terminal, process, about, video).

### State Management

MobX with `makeObservable` pattern. Stores live in `src/renderer/main/store/` (per-feature stores: application, file, layout, process, webview, settings). Shared base store in `src/share/renderer/store/BaseStore.ts`.

### Build Configuration

Three Vite configs target the different Electron contexts:
- `vite.config.ts` — Renderer (React app)
- `vite.main.ts` — Main process (CommonJS, Node.js)
- `vite.preload.ts` — Preload scripts (CommonJS, Electron context)

Path aliases (`common`, `share`) are configured in Vite for cross-directory imports.

### Key Libraries

- **`@devicefarmer/adbkit`** — ADB client for device communication
- **`@yume-chan/scrcpy`** — Screen mirroring protocol
- **`luna-*` packages** — Custom UI component library (toolbar, modal, setting, data-grid, logcat, tab, split-pane, etc.)
- **`licia`** — Utility library
- **`@xterm/xterm`** — Terminal emulation
- **`protobufjs`** — Protocol buffer support for wire protocol (definitions in `server/server/src/main/proto/`)

### IPC Communication

Types for IPC functions are defined in `src/common/types.ts`. The main process exposes 100+ typed endpoints covering device management, shell control, file operations, package management, screen capture, port mapping, and more.

### Internationalization

Custom i18n system with language files in `src/common/langs/` and `src/share/common/langs/`. Supports: en-US, zh-CN, zh-TW, ar, ru, tr, fr, pt, es.

## Code Style

- Prettier: no semicolons, single quotes, 80 char width
- CSS Modules (`.module.scss`) for component-scoped styling
- React functional components with hooks and MobX `observer` wrappers
- No test framework is configured
