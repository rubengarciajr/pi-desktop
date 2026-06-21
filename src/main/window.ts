import { BrowserWindow, shell, BrowserWindowConstructorOptions, nativeImage } from "electron";
import { join } from "node:path";
import { existsSync } from "node:fs";

const isDev = !!process.env["ELECTRON_RENDERER_URL"];

export function createMainWindow(): BrowserWindow {
  // Load the app icon for the dock/taskbar.
  const iconPath = join(__dirname, "../../resources/icon.png");
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  const options: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#0f0f10",
    vibrancy: "under-window",
    visualEffectState: "active",
    ...(icon && !icon.isEmpty() ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  const win = new BrowserWindow(options);

  win.on("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}
