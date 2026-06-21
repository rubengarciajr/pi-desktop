import { autoUpdater } from "electron-updater";
import { app, BrowserWindow } from "electron";

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  // Only check for updates in packaged builds (dev would have no update server).
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    send(getMainWindow, "pi:update", { status: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    send(getMainWindow, "pi:update", { status: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    send(getMainWindow, "pi:update", { status: "up-to-date" });
  });

  autoUpdater.on("error", (err) => {
    send(getMainWindow, "pi:update", { status: "error", message: String(err) });
  });

  autoUpdater.on("download-progress", (progress) => {
    send(getMainWindow, "pi:update", {
      status: "downloading",
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", () => {
    send(getMainWindow, "pi:update", { status: "downloaded" });
  });

  // Check for updates after a short delay (let the app settle).
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}

function send(getMainWindow: () => BrowserWindow | null, channel: string, data: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
