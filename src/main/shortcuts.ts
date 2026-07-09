import { globalShortcut, BrowserWindow } from "electron";

/** Toggle window visibility via a global hotkey. */
export function registerShortcuts(getMainWindow: () => BrowserWindow | null): void {
  // Cmd+Shift+P toggles the window
  const ret = globalShortcut.register("CommandOrControl+Shift+P", () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  if (!ret) {
    console.error("[pi-desktop] Failed to register global shortcut");
  }
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
