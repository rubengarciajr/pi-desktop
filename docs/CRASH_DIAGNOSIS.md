# Pi Desktop — Crash-on-Launch Diagnosis (v0.3.2 on Apple Silicon)

> **Date:** July 6, 2026
> **Affected:** Any Mac downloaded the v0.3.x DMG via the **in-app updater** (v0.3.1+)
> **Symptom:** App closes immediately on launch, or macOS shows *"Pi Desktop is damaged and can't be opened"*
> **Severity:** P0 — blocks all users who updated via the in-app downloader

---

## Root cause

The in-app update downloader (added in v0.3.1) saves the DMG to a temp directory and opens it via `shell.openPath()`. The downloaded file inherits the **`com.apple.quarantine`** extended attribute from the parent app.

When the user drags the app from the mounted DMG into `/Applications`, the quarantine flag persists. On **Apple Silicon (M1–M5)**, macOS enforces a strict policy: an **ad-hoc signed** app (which Pi Desktop is — no Apple Developer certificate) **cannot run at all if quarantined**. The process is killed on launch with SIGKILL by `amfid` (Apple Mobile File Integrity Daemon).

This is a macOS Sequoia/Sonoma hardening change. On Intel, the same app shows *"unidentified developer"* (bypassable via right-click → Open). On Apple Silicon, it's a hard crash with no UI.

### The code path

`src/main/updater.ts` → `pi:update:download` handler:

```ts
const destDir = join(tmpdir(), "pi-desktop-update");      // temp location
const destPath = join(destDir, filename);                 // Pi-Desktop-0.3.2.dmg
// ... download writes to destPath ...
const errMsg = await shell.openPath(destPath);            // ← opens with quarantine intact
```

The downloaded DMG is **never stripped of `com.apple.quarantine`** before being opened in Finder.

---

## Verification

To confirm this is the issue on the affected machine:

```bash
# 1. Check if the installed app is quarantined
xattr -l "/Applications/Pi Desktop.app"
# If you see "com.apple.quarantine", that's the cause.

# 2. Immediate fix (no rebuild needed):
xattr -cr "/Applications/Pi Desktop.app"
# App will now launch normally.
```

If `xattr -cr` fixes it, this diagnosis is confirmed.

---

## Fixes

### Fix 1 (immediate, in-app): Strip quarantine before opening the DMG

In `src/main/updater.ts`, strip `com.apple.quarantine` from the downloaded DMG before calling `shell.openPath()`:

```ts
import { execFile } from "node:child_process";

// After the download completes and before openPath:
try {
  execFileSync("xattr", ["-cr", destPath]);
} catch {}
const errMsg = await shell.openPath(destPath);
```

This ensures the DMG (and the `.app` inside it) launches without quarantine when mounted.

**Limitation:** This only helps users who update via a *future* v0.3.3+ build. Users already on a crashed v0.3.2 must use the terminal command above or download v0.3.3+ fresh from GitHub.

### Fix 2 (CI/build): Already correct — no change needed

The `build/afterSign.cjs` hook already strips xattrs and ad-hoc signs the app in CI. The DMG that GitHub Actions publishes is clean. The problem is purely the **in-app download path** re-adding quarantine.

### Fix 3 (permanent): Apple Developer Certificate

The real fix is to enroll in the Apple Developer Program ($99/year) and sign with a real **Developer ID Application** certificate + notarize via `notarytool`. A notarized app runs regardless of quarantine. This is already on the roadmap — see the section in the prior session's notes.

---

## Reproduction

1. On an Apple Silicon Mac, install Pi Desktop v0.3.1 or v0.3.2
2. Wait for the update banner (or downgrade to trigger it)
3. Click Download — the DMG downloads in-app and opens in Finder
4. Drag Pi Desktop to `/Applications`, replacing the old version
5. Launch → **crash** (no window appears, dock icon bounces once and dies)

---

## Files involved

| File | Role |
|---|---|
| `src/main/updater.ts` | The download handler (`pi:update:download`) — needs the xattr strip |
| `build/afterSign.cjs` | CI signing — already correct |
| `src/renderer/src/components/UpdateBanner.tsx` | UI — no change needed |

---

## Action items

- [x] Root cause identified
- [ ] Apply Fix 1 to `updater.ts` (strip `com.apple.quarantine` before `openPath`)
- [ ] Ship v0.3.3 with the fix
- [ ] Communicate to existing v0.3.2 users: either run `xattr -cr` or download v0.3.3 from GitHub
- [ ] Long-term: Apple Developer Certificate + notarization (Fix 3)
