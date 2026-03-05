# Update Checker Design

## Goal

Replace `electron-updater` with a lightweight GitHub Releases-based update checker. App is unsigned, so no auto-install — guide users to download and manually reinstall.

## Source

GitHub Releases API: `https://api.github.com/repos/danweiyuancircle/aya_plus_ai/releases/latest`

## Timing

- Auto-check every 24 hours
- Manual check via menu "Check Update..."

## Flow

1. Main process requests GitHub Releases API
2. Compare `tag_name` (e.g. `v1.17.0`) with local `package.json` version
3. IPC send result to renderer
4. Renderer shows status bar indicator if update available
5. User clicks indicator -> Modal with: current version, new version, release notes
6. "Download" button opens browser with direct asset URL for current platform
7. Manual check with no update -> alert "Already latest version"

## Asset URL Pattern

`https://github.com/danweiyuancircle/aya_plus_ai/releases/download/v{version}/{productName}-{version}-{os}-{arch}.{ext}`

| Platform | Filename |
|----------|----------|
| macOS arm64 | AYAPlus-{ver}-mac-arm64.dmg |
| macOS x64 | AYAPlus-{ver}-mac-x64.dmg |
| Windows x64 | AYAPlus-{ver}-win-x64.exe |
| Linux x64 | AYAPlus-{ver}-linux-x64.AppImage |

## UI

- Status bar: show update icon/text when update available
- Click -> Modal with version info, release notes (markdown), download button
- Modal footer: "Please close the app after download and perform a full reinstall"
- Manual check no update: `Modal.alert("Already latest version")`

## Changes

- Remove `electron-updater` dependency
- Rewrite `src/share/main/lib/updater.ts` to use `axios` + GitHub API
- Update `src/share/renderer/lib/hooks.ts` — new IPC events with version info
- Add status bar update indicator in renderer
- Update i18n strings
