import { app, BrowserWindow } from "electron";
import { fixPath } from "./fix-path";
import { createMainWindow } from "./window";

// Repair PATH before ANY child_process call. macOS GUI apps launched from
// Finder/Dock get a minimal PATH that omits node/npm/pi; without this the
// installer fails with "npm: command not found" and the Packages view can't
// reach the pi CLI. Must run before pool creation / session init below.
fixPath();
import { registerIpc } from "./ipc";
import { createAppMenu } from "./menu";
import { createTray } from "./tray";
import { registerShortcuts, unregisterShortcuts } from "./shortcuts";
import { initAutoUpdater } from "./updater";
import { SessionPool } from "./pi/SessionPool";
import { ensureHeadlessDefault } from "./webSearch";
import { healCustomModelKeys } from "./models";

let mainWindow: BrowserWindow | null = null;
const pool = new SessionPool();

const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  // Create window FIRST so it appears immediately.
  // Session pool init can take a few seconds (SDK import, auth load).
  mainWindow = createMainWindow();

  createAppMenu(() => mainWindow);
  createTray(() => mainWindow);
  registerShortcuts(() => mainWindow);

  registerIpc(pool, () => mainWindow);
  initAutoUpdater(() => mainWindow);

  // Default web search to headless (no browser curator) unless the user opted in.
  ensureHeadlessDefault();

  // Repair any local model providers whose key is a placeholder, all at once,
  // so the user never has to open and re-save each affected model.
  try {
    const healed = healCustomModelKeys();
    if (healed > 0) console.log(`[pi-desktop] Healed ${healed} local model provider key(s).`);
  } catch (err) {
    console.error("[pi-desktop] healCustomModelKeys failed:", err);
  }

  // Initialize session pool AFTER window is created and showing.
  try {
    const initialTabId = `tab-${Date.now()}`;
    await pool.createForTab(initialTabId);
    pool.setActiveTab(initialTabId);
  } catch (err) {
    console.error("[pi-desktop] Failed to init pi session pool:", err);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  unregisterShortcuts();
  pool.dispose();
});
