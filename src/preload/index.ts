import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

const invoke = <T>(channel: string) => {
  return (args?: any): Promise<T> => ipcRenderer.invoke(channel, args);
};

/**
 * Typed API exposed to the renderer via window.pi.
 * Each method maps 1:1 to an ipcMain.handle registered in src/main/ipc.ts.
 */
const api = {
  // Tab management
  createTab: invoke("pi:tab.create"),
  setActiveTab: invoke("pi:tab.setActive"),
  removeTab: invoke("pi:tab.remove"),

  // Prompting
  prompt: invoke("pi:prompt"),
  steer: invoke("pi:steer"),
  followUp: invoke("pi:followUp"),
  abort: invoke("pi:abort"),

  // Session
  newSession: invoke("pi:session.new"),
  switchSession: invoke("pi:session.switch"),
  fork: invoke("pi:session.fork"),
  clone: invoke("pi:session.clone"),
  listSessions: invoke("pi:session.list"),
  listAllSessions: invoke("pi:session.listAll"),
  getSessionTree: invoke("pi:session.tree"),
  getForkMessages: invoke("pi:session.forkMessages"),
  renameSession: invoke("pi:session.rename"),
  exportHtml: invoke("pi:session.exportHtml"),
  getMessages: invoke("pi:messages"),
  getState: invoke("pi:state"),
  getSessionStats: invoke("pi:stats"),

  // Model & thinking
  setModel: invoke("pi:model.set"),
  cycleModel: invoke("pi:model.cycle"),
  setThinkingLevel: invoke("pi:thinking.set"),
  cycleThinkingLevel: invoke("pi:thinking.cycle"),
  getAvailableModels: invoke("pi:model.available"),

  // Compaction
  compact: invoke("pi:compact"),
  abortCompaction: invoke("pi:compact.abort"),
  setAutoCompaction: invoke("pi:autoCompaction"),

  // Auth
  getAuthStatus: invoke("pi:auth.status"),
  setApiKey: invoke("pi:auth.setApiKey"),
  login: invoke("pi:auth.login"),
  logout: invoke("pi:auth.logout"),

  // Settings
  getSettings: invoke("pi:settings.get"),
  setSettings: invoke("pi:settings.set"),

  // Extensions / skills / themes / commands
  getCommands: invoke("pi:commands"),
  getExtensions: invoke("pi:extensions"),
  getSkills: invoke("pi:skills"),
  getThemes: invoke("pi:themes"),
  getTools: invoke("pi:tools"),

  // Custom models management
  customModelsList: invoke("pi:models.custom.list"),
  customModelAdd: invoke("pi:models.custom.add"),
  customModelRemove: invoke("pi:models.custom.remove"),
  modelsJsonPath: invoke("pi:models.json.path"),
  openModelsJson: invoke("pi:models.json.open"),

  // Misc
  getCwd: invoke("pi:cwd.get"),
  setCwd: invoke("pi:cwd.set"),
  pickDirectory: invoke("pi:pickDirectory"),
  getGitInfo: invoke("pi:git.info"),

  // Install
  checkPiInstalled: invoke("pi:install.check"),
  startPiInstall: invoke("pi:install.start"),
  systemCheck: invoke("pi:system.check"),
};

// GitHub API
const github = {
  getAuthStatus: invoke("github:auth.status"),
  verifyToken: invoke("github:auth.verify"),
  logout: invoke("github:auth.logout"),
  getSyncState: invoke("github:sync.state"),
  push: invoke("github:sync.push"),
  pull: invoke("github:sync.pull"),
  createRepo: invoke("github:repo.create"),
  listRepos: invoke("github:repo.list"),
  attachRepo: invoke("github:repo.attach"),
  cloneRepo: invoke("github:repo.clone"),
  getLinkage: invoke("github:repo.linkage"),
};

// Packages API
const packages = {
  search: invoke("packages:search"),
  installed: invoke("packages:installed"),
  install: invoke("packages:install"),
  remove: invoke("packages:remove"),
};

const events = {
  onEvent: (listener: (event: any) => void) => {
    const wrapped = (_e: IpcRendererEvent, event: any) => listener(event);
    ipcRenderer.on("pi:event", wrapped);
    return () => ipcRenderer.removeListener("pi:event", wrapped);
  },
  onState: (listener: (state: any) => void) => {
    const wrapped = (_e: IpcRendererEvent, state: any) => listener(state);
    ipcRenderer.on("pi:state", wrapped);
    return () => ipcRenderer.removeListener("pi:state", wrapped);
  },
  onQueue: (listener: (queue: any) => void) => {
    const wrapped = (_e: IpcRendererEvent, queue: any) => listener(queue);
    ipcRenderer.on("pi:queue", wrapped);
    return () => ipcRenderer.removeListener("pi:queue", wrapped);
  },
  onDiagnostics: (listener: (msg: string) => void) => {
    const wrapped = (_e: IpcRendererEvent, msg: string) => listener(msg);
    ipcRenderer.on("pi:diag", wrapped);
    return () => ipcRenderer.removeListener("pi:diag", wrapped);
  },
  onMenu: (listener: (action: string) => void) => {
    const wrapped = (_e: IpcRendererEvent, action: string) => listener(action);
    ipcRenderer.on("pi:menu", wrapped);
    return () => ipcRenderer.removeListener("pi:menu", wrapped);
  },
  onSessionReset: (listener: (data: { sessionId: string; sessionFile?: string }) => void) => {
    const wrapped = (_e: IpcRendererEvent, data: { sessionId: string; sessionFile?: string }) => listener(data);
    ipcRenderer.on("pi:sessionReset", wrapped);
    return () => ipcRenderer.removeListener("pi:sessionReset", wrapped);
  },
  onInstallProgress: (listener: (progress: any) => void) => {
    const wrapped = (_e: IpcRendererEvent, progress: any) => listener(progress);
    ipcRenderer.on("pi:install.progress", wrapped);
    return () => ipcRenderer.removeListener("pi:install.progress", wrapped);
  },
  onInstallDone: (listener: (result: any) => void) => {
    const wrapped = (_e: IpcRendererEvent, result: any) => listener(result);
    ipcRenderer.on("pi:install.done", wrapped);
    return () => ipcRenderer.removeListener("pi:install.done", wrapped);
  },
  onPackagesChanged: (listener: () => void) => {
    const wrapped = () => listener();
    ipcRenderer.on("packages:installed.changed", wrapped);
    return () => ipcRenderer.removeListener("packages:installed.changed", wrapped);
  },
  onUpdate: (listener: (data: any) => void) => {
    const wrapped = (_e: IpcRendererEvent, data: any) => listener(data);
    ipcRenderer.on("pi:update", wrapped);
    return () => ipcRenderer.removeListener("pi:update", wrapped);
  },
  restartForUpdate: () => ipcRenderer.send("pi:update:restart"),
  checkForUpdates: invoke("pi:update:check"),
};

try {
  contextBridge.exposeInMainWorld("pi", {
    api,
    github,
    packages,
    events,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      pi: "0.79.9",
    },
  });
} catch (err) {
  console.error("[preload] Failed to expose pi API:", err);
}
