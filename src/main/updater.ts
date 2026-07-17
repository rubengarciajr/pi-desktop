import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { compareVersions } from "../shared/version";
import { validateGitHubReleaseDmgUrl } from "../shared/updateUrl";
import { getUpdateToken } from "./updateToken";
import { tmpdir } from "node:os";
import { basename, join, dirname } from "node:path";
import { createWriteStream, constants as FS } from "node:fs";
import { mkdir, unlink, writeFile, chmod, access } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";

const REPO_OWNER = "rubengarciajr";
const REPO_NAME = "pi-desktop";
const MAX_UPDATE_BYTES = 512 * 1024 * 1024;

/**
 * Detached helper that installs a downloaded update after the app quits. It
 * receives all paths as positional args (no string interpolation, so nothing
 * can be injected), waits for the running app to exit, then swaps the bundle.
 *
 * The new bundle is staged beside the target and swapped in via `mv`, with a
 * restore step on failure — so a copy error can never leave the user with no
 * installed app. Quarantine is cleared so the ad-hoc-signed app launches.
 */
const INSTALL_SCRIPT = `#!/bin/bash
DMG="$1"; TARGET="$2"; MNT="$3"; PID="$4"

# Safety: only ever operate on a real .app bundle path.
case "$TARGET" in
  *.app) : ;;
  *) exit 1 ;;
esac

# Wait (max ~60s) for the running app to exit so its bundle is replaceable.
for _ in $(seq 1 200); do
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.3
done
# NEVER swap a live bundle: if the app is somehow still running, bail out.
if kill -0 "$PID" 2>/dev/null; then
  open "$TARGET" 2>/dev/null || true; exit 1
fi

rm -rf "$MNT"; mkdir -p "$MNT"
# No -noverify: let hdiutil checksum the image so a corrupt download can't be
# installed over the (about-to-be-deleted) old app.
if ! hdiutil attach -nobrowse -readonly -mountpoint "$MNT" "$DMG" >/dev/null 2>&1; then
  open "$TARGET" 2>/dev/null || true; exit 1
fi

APP=$(ls -d "$MNT"/*.app 2>/dev/null | head -1)
if [ -z "$APP" ]; then
  hdiutil detach "$MNT" >/dev/null 2>&1 || true
  open "$TARGET" 2>/dev/null || true; exit 1
fi

# Stage the new bundle first so a copy failure never leaves no app installed.
STAGING="$TARGET.new"; rm -rf "$STAGING"
if ! ditto "$APP" "$STAGING"; then
  rm -rf "$STAGING"; hdiutil detach "$MNT" >/dev/null 2>&1 || true
  open "$TARGET" 2>/dev/null || true; exit 1
fi
xattr -cr "$STAGING" 2>/dev/null || true

# Atomic-ish swap. Move-aside must SUCCEED -- if it fails, TARGET still exists
# and moving STAGING onto it would nest the new bundle inside the old one
# (BSD mv) while still returning 0. So hard-fail rather than corrupt the bundle.
rm -rf "$TARGET.old"
if ! mv "$TARGET" "$TARGET.old"; then
  rm -rf "$STAGING"; hdiutil detach "$MNT" >/dev/null 2>&1 || true
  open "$TARGET" 2>/dev/null || true; exit 1
fi
if ! mv "$STAGING" "$TARGET"; then
  [ -d "$TARGET.old" ] && mv "$TARGET.old" "$TARGET"
  rm -rf "$STAGING"; hdiutil detach "$MNT" >/dev/null 2>&1 || true
  open "$TARGET" 2>/dev/null || true; exit 1
fi
rm -rf "$TARGET.old"

hdiutil detach "$MNT" >/dev/null 2>&1 || true
rm -rf "$MNT" "$DMG" 2>/dev/null || true
open "$TARGET"
`;

/**
 * Initialize theme forwarding and update checking.
 *
 * For unsigned macOS apps, electron-updater's auto-download + quitAndInstall
 * doesn't work reliably. Instead we use a lightweight GitHub API check:
 * fetch latest release version, compare, and deep-link to the download page.
 */
export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  // --- Theme forwarding ---
  ipcMain.handle("pi:theme:get", () => ({
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    themeSource: nativeTheme.themeSource,
  }));

  // Renderer can override the system theme.
  ipcMain.handle("pi:theme:set", (_e, source: "system" | "light" | "dark") => {
    if (source !== "system" && source !== "light" && source !== "dark") {
      return { success: false };
    }
    nativeTheme.themeSource = source;
    return { success: true };
  });

  nativeTheme.on("updated", () => {
    send(getMainWindow, "pi:theme:changed", {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    });
  });

  // --- Update check via GitHub API ---
  ipcMain.handle("pi:update:check", async () => {
    try {
      const currentVersion = app.getVersion();
      // The repo is public, so anonymous requests reach the releases API
      // directly. Private forks can opt into a runtime token file without
      // embedding a reusable secret in the distributed app.
      const token = getUpdateToken();
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
        {
          headers: {
            "User-Agent": "pi-desktop-updater",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) {
        return { status: "error", message: `GitHub API returned ${res.status}` };
      }
      const data: any = await res.json();
      const latestVersion = (data.tag_name || "").replace(/^v/, "");

      if (!latestVersion) {
        return { status: "error", message: "Could not parse latest version" };
      }

      if (compareVersions(latestVersion, currentVersion) > 0) {
        const dmgAsset = (data.assets || []).find(
          (a: any) => a.name.endsWith(".dmg") && a.name.includes(latestVersion),
        );
        return {
          status: "available",
          version: latestVersion,
          downloadUrl: dmgAsset?.browser_download_url || data.html_url,
          releaseUrl: data.html_url,
          releaseNotes: data.body || "",
        };
      }

      return { status: "up-to-date", version: currentVersion };
    } catch (e: any) {
      return { status: "error", message: e?.message ?? String(e) };
    }
  });

  // Download the DMG in-process and open it in Finder, which auto-mounts the
  // disk image and reveals the app for drag-to-Applications. Skips the
  // browser step entirely. Falls back to opening the release page on error.
  ipcMain.handle("pi:update:download", async (_e, args: any) => {
    const url: string | undefined = args?.url;
    const win = getMainWindow();
    let destPath: string | undefined;
    const reportProgress = (loaded: number, total: number) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("pi:update:progress", { loaded, total });
      }
    };

    try {
      // Resolve the latest DMG asset URL (anonymous; repo is public).
      let dmgUrl: string | undefined = url;
      let filename = "Pi-Desktop-latest.dmg";
      if (!dmgUrl) {
        const token = getUpdateToken();
        const res = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
          {
            headers: {
              "User-Agent": "pi-desktop-updater",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        const data: any = await res.json();
        const asset = (data.assets || []).find((a: any) => a.name.endsWith(".dmg"));
        if (!asset?.browser_download_url) throw new Error("No DMG asset found in latest release");
        dmgUrl = asset.browser_download_url;
        filename = asset.name;
      }
      const downloadUrl = validateGitHubReleaseDmgUrl(dmgUrl!, REPO_OWNER, REPO_NAME);

      // Stream the download to a temp file, reporting progress.
      const destDir = join(tmpdir(), "pi-desktop-update");
      await mkdir(destDir, { recursive: true });
      destPath = join(destDir, basename(filename));

      const res = await fetch(downloadUrl, { redirect: "follow" });
      if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);

      const total = Number(res.headers.get("content-length") || 0);
      if (total > MAX_UPDATE_BYTES) throw new Error("Update DMG is unexpectedly large.");
      let loaded = 0;
      const stream = createWriteStream(destPath);
      const reader = res.body.getReader();
      // Read the stream chunk-by-chunk so we can report progress to the
      // renderer, which shows a percentage on the Download button.
      // (Node 20+ web streams: pump via getReader on the ReadableStream.)
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded += value.byteLength;
          if (loaded > MAX_UPDATE_BYTES) {
            await reader.cancel();
            throw new Error("Update DMG exceeded the maximum allowed size.");
          }
          if (!stream.write(Buffer.from(value))) await once(stream, "drain");
          reportProgress(loaded, total);
        }
        const finished = once(stream, "finish");
        stream.end();
        await finished;
      } catch (error) {
        // Cancel the read side so the underlying fetch connection doesn't
        // linger until GC on a write-side failure (e.g. disk full).
        reader.cancel().catch(() => {});
        stream.destroy();
        throw error;
      }

      // Strip the com.apple.quarantine extended attribute from the downloaded
      // DMG before opening it. On Apple Silicon, an ad-hoc signed app that
      // retains quarantine crashes on launch ("damaged and can't be opened").
      // xattr -cr clears all extended attributes so the mounted app runs clean.
      try {
        execFileSync("xattr", ["-cr", destPath]);
      } catch {
        // Non-fatal: openPath may still work if no quarantine was present.
      }

      // Download complete. The renderer drives the next step (install & restart,
      // or reveal in Finder as a fallback) — we no longer auto-open Finder here.
      return { success: true, path: destPath };
    } catch (e: any) {
      console.error("[updater] DMG download failed:", e);
      if (destPath) await unlink(destPath).catch(() => {});
      // Last-resort fallback: send the user to the release page in a browser.
      const fallback = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
      await shell.openExternal(fallback);
      return { success: false, error: e?.message ?? String(e) };
    }
  });

  // Install a downloaded update in place and relaunch, without Apple Developer
  // ID signing. macOS's Squirrel-based auto-update requires a signed app, so
  // instead we mount the DMG, swap the app bundle, and relaunch via a detached
  // helper that runs after we quit. Returns { fallback: true } when auto-install
  // can't run (dev mode, non-writable install dir, etc.) so the UI can offer the
  // manual "reveal in Finder" path instead.
  ipcMain.handle("pi:update:install", async (_e, args: any) => {
    const dmgPath: string | undefined = args?.path;
    try {
      if (process.platform !== "darwin") {
        return { success: false, fallback: true, error: "Auto-install is macOS-only." };
      }
      if (!app.isPackaged) {
        return { success: false, fallback: true, error: "Auto-install is only available in the packaged app." };
      }
      if (!dmgPath) {
        return { success: false, fallback: true, error: "No downloaded update was found." };
      }
      // Only ever mount+install a DMG we downloaded ourselves. This handler
      // replaces the app's own executable, so a renderer-supplied path is a
      // code-execution vector if not constrained to our temp dir.
      const expectedDir = join(tmpdir(), "pi-desktop-update");
      if (!dmgPath.startsWith(expectedDir + "/") || dmgPath.includes("..")) {
        return { success: false, fallback: true, error: "Invalid update path." };
      }
      await access(dmgPath, FS.R_OK);

      // Resolve the running app's bundle from its executable path:
      //   /Applications/Pi Desktop.app/Contents/MacOS/Pi Desktop -> /Applications/Pi Desktop.app
      const bundlePath = process.execPath.match(/^(.*\.app)\//)?.[1];
      if (!bundlePath) {
        return { success: false, fallback: true, error: "Could not locate the app bundle." };
      }
      // If we can't write the install directory (e.g. it needs admin rights),
      // fall back to the manual Finder flow rather than failing mid-swap.
      try {
        await access(dirname(bundlePath), FS.W_OK);
      } catch {
        return { success: false, fallback: true, error: "The app's folder isn't writable without admin rights." };
      }

      const workDir = join(tmpdir(), "pi-desktop-update");
      await mkdir(workDir, { recursive: true });
      const scriptPath = join(workDir, "install.sh");
      await writeFile(scriptPath, INSTALL_SCRIPT, "utf8");
      await chmod(scriptPath, 0o755);
      const mountPoint = join(workDir, "mnt");

      const child = spawn(
        "/bin/bash",
        [scriptPath, dmgPath, bundlePath, mountPoint, String(process.pid)],
        { detached: true, stdio: "ignore" },
      );
      child.unref();

      // Quit so the detached helper can replace the bundle and relaunch us.
      // Delay long enough for this success response to flush to the renderer
      // before the IPC channel tears down (the child waits on our PID anyway).
      setTimeout(() => app.quit(), 800);
      return { success: true };
    } catch (e: any) {
      console.error("[updater] install failed:", e);
      return { success: false, fallback: true, error: e?.message ?? String(e) };
    }
  });

  // Fallback for when auto-install can't run: open the DMG in Finder so the
  // user can drag the app to Applications themselves (the pre-auto-install flow).
  ipcMain.handle("pi:update:reveal", async (_e, args: any) => {
    const p: string | undefined = args?.path;
    if (!p) return { success: false, error: "No downloaded update to open." };
    const errMsg = await shell.openPath(p);
    if (errMsg) return { success: false, error: errMsg };
    return { success: true };
  });

  // Clean up a previously-downloaded update DMG (optional housekeeping).
  ipcMain.handle("pi:update:cleanup", async () => {
    try {
      const dir = join(tmpdir(), "pi-desktop-update");
      const { rm } = await import("node:fs/promises");
      // Recursive: the install flow leaves a mnt/ subdirectory that unlink can't remove.
      await rm(dir, { recursive: true, force: true });
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}

function send(getMainWindow: () => BrowserWindow | null, channel: string, data: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
