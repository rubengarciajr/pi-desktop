import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { compareVersions } from "../shared/version";
import { getUpdateToken } from "./updateToken";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const REPO_OWNER = "rubengarciajr";
const REPO_NAME = "pi-desktop";

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
      // directly. The optional token is kept as an escape hatch for anyone who
      // forks to a private repo (baked in at build time or read from
      // ~/.pi-desktop-update-token).
      const token = getUpdateToken();
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
        {
          headers: {
            "User-Agent": "pi-desktop-updater",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
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
          (a: any) => a.name.endsWith(".dmg") && a.name.includes(latestVersion)
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
          { headers: { "User-Agent": "pi-desktop-updater", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
        );
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        const data: any = await res.json();
        const asset = (data.assets || []).find((a: any) => a.name.endsWith(".dmg"));
        if (!asset?.browser_download_url) throw new Error("No DMG asset found in latest release");
        dmgUrl = asset.browser_download_url;
        filename = asset.name;
      }
      const downloadUrl: string = dmgUrl!;

      // Stream the download to a temp file, reporting progress.
      const destDir = join(tmpdir(), "pi-desktop-update");
      await mkdir(destDir, { recursive: true });
      const destPath = join(destDir, filename);

      const res = await fetch(downloadUrl, { redirect: "follow" });
      if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);

      const total = Number(res.headers.get("content-length") || 0);
      let loaded = 0;
      const stream = createWriteStream(destPath);
      const reader = res.body.getReader();
      // Read the stream chunk-by-chunk so we can report progress to the
      // renderer, which shows a percentage on the Download button.
      // (Node 20+ web streams: pump via getReader on the ReadableStream.)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stream.write(Buffer.from(value));
        loaded += value.byteLength;
        reportProgress(loaded, total);
      }
      await new Promise<void>((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
        stream.end();
      });

      // Strip the com.apple.quarantine extended attribute from the downloaded
      // DMG before opening it. On Apple Silicon, an ad-hoc signed app that
      // retains quarantine crashes on launch ("damaged and can't be opened").
      // xattr -cr clears all extended attributes so the mounted app runs clean.
      try {
        execFileSync("xattr", ["-cr", destPath]);
      } catch {
        // Non-fatal: openPath may still work if no quarantine was present.
      }

      // Open the DMG in Finder — macOS mounts it and reveals the app bundle.
      // shell.openPath returns "" on success, or an error string on failure.
      const errMsg = await shell.openPath(destPath);
      if (errMsg) throw new Error(`Could not open DMG: ${errMsg}`);

      return { success: true, path: destPath };
    } catch (e: any) {
      console.error("[updater] DMG download failed:", e);
      // Last-resort fallback: send the user to the release page in a browser.
      const fallback = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
      await shell.openExternal(fallback);
      return { success: false, error: e?.message ?? String(e) };
    }
  });

  // Clean up a previously-downloaded update DMG (optional housekeeping).
  ipcMain.handle("pi:update:cleanup", async () => {
    try {
      const dir = join(tmpdir(), "pi-desktop-update");
      const { readdir } = await import("node:fs/promises");
      for (const f of await readdir(dir)) {
        await unlink(join(dir, f)).catch(() => {});
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Check for updates on startup (non-blocking, just notifies the renderer).
  setTimeout(async () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    // The renderer will call pi:update:check itself; this is just a heads-up.
  }, 3000);
}

function send(getMainWindow: () => BrowserWindow | null, channel: string, data: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
