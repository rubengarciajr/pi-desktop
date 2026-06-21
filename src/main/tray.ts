import { Tray, Menu, nativeImage, BrowserWindow } from "electron";
import { join } from "node:path";

let tray: Tray | null = null;

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  const iconPath = join(__dirname, "../../resources/tray-icon-template.png");
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    // Mark as template so macOS auto-adapts to dark/light mode.
    icon.setTemplateImage(true);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Pi Desktop");

  const buildMenu = () =>
    Menu.buildFromTemplate([
      {
        label: "Show Pi Desktop",
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: "New Session",
        accelerator: "CmdOrCtrl+N",
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.webContents.send("pi:menu", { action: "newSession" });
          }
        },
      },
      {
        label: "Quick Prompt",
        accelerator: "CmdOrCtrl+L",
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.focus();
            win.webContents.send("pi:menu", { action: "focusPrompt" });
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        accelerator: "CmdOrCtrl+Q",
        role: "quit",
      },
    ]);

  tray.setContextMenu(buildMenu());
  tray.on("click", () => {
    const win = getMainWindow();
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    }
  });

  return tray;
}
