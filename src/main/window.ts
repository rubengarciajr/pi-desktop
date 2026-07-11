import { BrowserWindow, shell, BrowserWindowConstructorOptions, nativeImage } from "electron";
import { join } from "node:path";
import { existsSync } from "node:fs";

const isDev = !!process.env["ELECTRON_RENDERER_URL"];

function openExternalUrl(rawUrl: string): void {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "mailto:") {
      console.warn(`[pi-desktop] Blocked external URL with unsupported protocol: ${url.protocol}`);
      return;
    }
    void shell.openExternal(url.toString());
  } catch {
    console.warn("[pi-desktop] Blocked malformed external URL");
  }
}

export function createMainWindow(): BrowserWindow {
  // Load the app icon for the dock/taskbar.
  const iconPath = join(__dirname, "../../resources/icon.png");
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  const options: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    show: true,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#0f0f10",
    vibrancy: "under-window",
    visualEffectState: "active",
    ...(icon && !icon.isEmpty() ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  const win = new BrowserWindow(options);

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription) => {
    console.error(`[pi-desktop] Renderer failed to load: ${errorCode} ${errorDescription}`);
  });

  win.webContents.on("render-process-gone", (_e, details) => {
    console.error(`[pi-desktop] Render process gone: ${details.reason}`);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });

  // Never let the app frame navigate away from the bundled renderer. Any
  // in-frame navigation (link, form, programmatic location change) to a
  // different URL is cancelled and handed to the OS browser instead.
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      openExternalUrl(url);
    }
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}
