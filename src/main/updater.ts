import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";

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
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
        {
          headers: { "User-Agent": "pi-desktop-updater" },
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

  // Open the release page in browser for manual download.
  ipcMain.handle("pi:update:download", async () => {
    const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    await shell.openExternal(url);
    return { success: true };
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

/** Returns positive if a > b, negative if a < b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}
