import { Menu, BrowserWindow, shell, app } from "electron";

export function createAppMenu(getMainWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ] as Electron.MenuItemConstructorOptions[],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Session",
          accelerator: "CmdOrCtrl+N",
          click: () => getMainWindow()?.webContents.send("pi:menu", { action: "newSession" }),
        },
        {
          label: "Switch Session…",
          accelerator: "CmdOrCtrl+O",
          click: () => getMainWindow()?.webContents.send("pi:menu", { action: "switchSession" }),
        },
        { type: "separator" as const },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ].filter(Boolean) as Electron.MenuItemConstructorOptions[],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => getMainWindow()?.webContents.send("pi:menu", { action: "toggleSidebar" }),
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Session",
      submenu: [
        {
          label: "Cycle Model",
          accelerator: "CmdOrCtrl+P",
          click: () => getMainWindow()?.webContents.send("pi:menu", { action: "cycleModel" }),
        },
        {
          label: "Cycle Thinking Level",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => getMainWindow()?.webContents.send("pi:menu", { action: "cycleThinking" }),
        },
        { type: "separator" },
        {
          label: "Compact Context",
          accelerator: "CmdOrCtrl+K",
          click: () => getMainWindow()?.webContents.send("pi:menu", { action: "compact" }),
        },
        {
          label: "Abort",
          accelerator: "CmdOrCtrl+.",
          click: () => getMainWindow()?.webContents.send("pi:menu", { action: "abort" }),
        },
      ],
    },
    {
      role: "window" as const,
      submenu: [{ role: "minimize" as const }, { role: "zoom" as const }, ...(isMac ? [{ type: "separator" as const }, { role: "front" as const }] : [])],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Pi Documentation",
          click: () => shell.openExternal("https://pi.dev/docs/latest"),
        },
        {
          label: "Pi Desktop GitHub",
          click: () => shell.openExternal("https://github.com/pi-desktop/pi-desktop"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
