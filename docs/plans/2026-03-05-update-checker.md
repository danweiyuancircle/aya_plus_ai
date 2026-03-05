# Update Checker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace electron-updater with a lightweight GitHub Releases API check that shows update availability in the status bar and lets users download the correct platform installer directly.

**Architecture:** Main process polls GitHub Releases API every 24h (and on manual trigger). Results are sent to renderer via IPC. Renderer shows a status bar indicator; clicking it opens a Modal with version info, release notes, and a direct download button.

**Tech Stack:** axios (existing), Electron IPC, React/MobX, luna-modal

---

### Task 1: Rewrite updater.ts — Main Process

**Files:**
- Modify: `src/share/main/lib/updater.ts`

**Step 1: Replace updater implementation**

Replace the entire file. Remove `electron-updater` import. Use `axios` to call GitHub API. Add 24h interval timer. Send structured data to renderer via IPC.

```ts
import axios from 'axios'
import * as window from './window'
import pkg from '../../../../package.json'

const GITHUB_API =
  'https://api.github.com/repos/danweiyuancircle/aya_plus_ai/releases/latest'
const CHECK_INTERVAL = 24 * 60 * 60 * 1000

interface ReleaseInfo {
  version: string
  body: string
  url: string
}

let latestRelease: ReleaseInfo | null = null

function getDownloadUrl(version: string): string {
  const base = `https://github.com/danweiyuancircle/aya_plus_ai/releases/download/v${version}`
  const name = pkg.productName

  if (process.platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    return `${base}/${name}-${version}-mac-${arch}.dmg`
  } else if (process.platform === 'win32') {
    return `${base}/${name}-${version}-win-x64.exe`
  }
  return `${base}/${name}-${version}-linux-x64.AppImage`
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

export async function checkUpdate(manual = false) {
  try {
    const { data } = await axios.get(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      timeout: 15000,
    })

    const remoteVersion = (data.tag_name || '').replace(/^v/, '')
    if (!remoteVersion) return

    if (compareVersions(remoteVersion, pkg.version) > 0) {
      latestRelease = {
        version: remoteVersion,
        body: data.body || '',
        url: getDownloadUrl(remoteVersion),
      }
      window.sendTo('main', 'updateAvailable', {
        currentVersion: pkg.version,
        newVersion: remoteVersion,
        releaseNotes: data.body || '',
        downloadUrl: latestRelease.url,
      })
    } else if (manual) {
      window.sendTo('main', 'updateNotAvailable')
    }
  } catch {
    if (manual) {
      window.sendTo('main', 'updateError')
    }
  }
}

export function init() {
  setTimeout(() => checkUpdate(), 5000)
  setInterval(() => checkUpdate(), CHECK_INTERVAL)
}
```

**Step 2: Commit**

```bash
git add src/share/main/lib/updater.ts
git commit -m "feat: rewrite updater to use GitHub Releases API"
```

---

### Task 2: Update Menu — Pass manual flag

**Files:**
- Modify: `src/main/lib/menu.ts:48-51`

**Step 1: Update checkUpdate call to pass manual=true**

In `src/main/lib/menu.ts`, change:
```ts
click() {
  updater.checkUpdate()
},
```
to:
```ts
click() {
  updater.checkUpdate(true)
},
```

**Step 2: Commit**

```bash
git add src/main/lib/menu.ts
git commit -m "feat: pass manual flag when checking update from menu"
```

---

### Task 3: Update i18n strings

**Files:**
- Modify: `src/share/common/langs/en-US.json`
- Modify: `src/share/common/langs/zh-CN.json`

**Step 1: Update en-US.json**

Replace existing update strings and add new ones:
```json
"updateAvailable": "New version available",
"updateErr": "Failed to check for updates",
"updateNotAvailable": "You are using the latest version",
"updateDownload": "Download Update",
"updateCurrentVersion": "Current version",
"updateNewVersion": "New version",
"updateReleaseNotes": "Release Notes",
"updateHint": "Please close the app after download and perform a full reinstall"
```

**Step 2: Update zh-CN.json**

```json
"updateAvailable": "发现新版本",
"updateErr": "检查更新失败",
"updateNotAvailable": "当前已是最新版本",
"updateDownload": "下载更新",
"updateCurrentVersion": "当前版本",
"updateNewVersion": "最新版本",
"updateReleaseNotes": "更新说明",
"updateHint": "请在下载完成后关闭应用，进行全量覆盖安装"
```

**Step 3: Commit**

```bash
git add src/share/common/langs/en-US.json src/share/common/langs/zh-CN.json
git commit -m "feat: add i18n strings for update checker"
```

---

### Task 4: Update hooks.ts — New IPC event handling

**Files:**
- Modify: `src/share/renderer/lib/hooks.ts`

**Step 1: Rewrite useCheckUpdate hook**

Replace the existing `useCheckUpdate` function. It now receives structured update data and stores it in a callback instead of opening a URL directly.

```ts
export function useCheckUpdate(
  onUpdateAvailable: (info: {
    currentVersion: string
    newVersion: string
    releaseNotes: string
    downloadUrl: string
  }) => void
) {
  useEffect(() => {
    const offUpdateError = main.on('updateError', () => {
      Modal.alert(t('updateErr'))
    })
    const offUpdateNotAvailable = main.on('updateNotAvailable', () => {
      Modal.alert(t('updateNotAvailable'))
    })
    const offUpdateAvailable = main.on('updateAvailable', (info: any) => {
      onUpdateAvailable(info)
    })
    return () => {
      offUpdateError()
      offUpdateNotAvailable()
      offUpdateAvailable()
    }
  }, [])
}
```

**Step 2: Commit**

```bash
git add src/share/renderer/lib/hooks.ts
git commit -m "feat: update useCheckUpdate hook to pass structured data"
```

---

### Task 5: Add update indicator to StatusBar

**Files:**
- Modify: `src/renderer/main/components/statusbar/StatusBar.tsx`
- Modify: `src/renderer/main/components/statusbar/StatusBar.module.scss`

**Step 1: Add update state and indicator to StatusBar.tsx**

Add a state for update info. Add a clickable indicator in the right section of the status bar. On click, show a Modal with version info, release notes, and download button.

In `StatusBar.tsx`, add:
- `useState` for update info
- `useCheckUpdate` hook call
- Update indicator element in the right side of status bar
- Click handler that shows Modal with update details

**Step 2: Add `.update` style to StatusBar.module.scss**

```scss
.update {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--color-primary-bg, rgba(22, 119, 255, 0.15));
  color: var(--color-primary, #1677ff);
  font-weight: 500;
  cursor: pointer;
  &:hover {
    background: var(--color-primary-bg-hover, rgba(22, 119, 255, 0.25));
  }
}
```

**Step 3: Commit**

```bash
git add src/renderer/main/components/statusbar/StatusBar.tsx src/renderer/main/components/statusbar/StatusBar.module.scss
git commit -m "feat: add update indicator to status bar with download modal"
```

---

### Task 6: Update App.tsx — Remove old useCheckUpdate usage

**Files:**
- Modify: `src/renderer/main/App.tsx`

**Step 1: Remove useCheckUpdate from App.tsx**

Remove the `import { useCheckUpdate }` line and the `useCheckUpdate('https://aya.liriliri.io')` call, since the hook is now called from StatusBar.

**Step 2: Commit**

```bash
git add src/renderer/main/App.tsx
git commit -m "refactor: move useCheckUpdate from App to StatusBar"
```

---

### Task 7: Remove electron-updater dependency

**Files:**
- Modify: `package.json`

**Step 1: Uninstall electron-updater**

```bash
npm uninstall electron-updater
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove electron-updater dependency"
```

---

### Task 8: Verify build

**Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors.
