import { ipcMain, BrowserWindow, dialog } from "electron";
import { SessionPool } from "./pi/SessionPool";
import { getGitInfo } from "./git";
import { isPiInstalled, getPiVersion, installPi } from "./installer";
import { invalidateSharedDeps } from "./pi/SharedDepsCache";
import { getCachedMessages, setCachedMessages, invalidateCache } from "./pi/MessageCache";
import {
  storeGitHubToken,
  getGitHubToken,
  clearGitHubToken,
  verifyToken,
  getGitHubAuthStatus,
  getSyncState,
  pushToRemote,
  pullFromRemote,
  createRepo,
  listUserRepos,
  attachRepo,
  cloneRepo,
  readRepoLinkage,
} from "./github";
import { searchPackages, getDownloadCounts } from "./packages";
import { listCustomModels, addCustomModel, removeCustomModel, getModelsPath } from "./models";
import { getWebSearchStatus, setWebSearchConfig } from "./webSearch";
import { getExtensionDetail, setExtensionConfig } from "./extensionDetail";
import { shell } from "electron";

/**
 * Registers all ipcMain handlers. Every call is routed to the correct
 * PiSessionManager via the SessionPool, keyed by tabId.
 */
export function registerIpc(
  pool: SessionPool,
  getMainWindow: () => BrowserWindow | null,
): void {
  const send = (channel: string, ...args: unknown[]) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
  };

  // --- Forward stable event stream to renderer ---
  pool.events.on(pool.AGENT_EVENT, (event: unknown) => send("pi:event", event));
  pool.events.on(pool.STATE_EVENT, (state: unknown) => send("pi:state", state));
  pool.events.on(pool.QUEUE_EVENT, (queue: unknown) => send("pi:queue", queue));
  pool.events.on(pool.DIAG_EVENT, (msg: string) => send("pi:diag", msg));
  pool.events.on(pool.SESSION_RESET_EVENT, (data: unknown) => send("pi:sessionReset", data));
  pool.events.on(pool.EXT_UI_EVENT, (message: unknown) => send("pi:extui", message));

  const handle = <Res>(
    channel: string,
    fn: (args: any) => Promise<Res> | Res,
  ) => {
    ipcMain.handle(channel, async (_e, args: any) => {
      try {
        return await fn(args ?? {});
      } catch (err: any) {
        console.error(`[pi-desktop] IPC ${channel} error:`, err);
        send("pi:diag", `Error in ${channel}: ${err?.message ?? String(err)}`);
        throw err;
      }
    });
  };

  /** Resolve a manager by tabId from args, falling back to active tab. */
  const mgr = async (args: any) => {
    const tabId = args?.tabId ?? pool.getActiveTab() ?? undefined;
    if (!tabId) throw new Error("No active tab");
    return pool.getOrCreate(tabId);
  };

  // --- Tab management ---
  handle("pi:tab.create", async (a) => {
    const tabId = a.tabId ?? `tab-${Date.now()}`;
    await pool.createForTab(tabId, a.cwd, { chatMode: a.mode === "chat" });
    pool.setActiveTab(tabId);
    return { tabId, success: true };
  });
  handle("pi:tab.setActive", (a) => {
    pool.setActiveTab(a.tabId);
    return { success: true };
  });
  handle("pi:tab.remove", (a) => {
    pool.removeTab(a.tabId);
    return { success: true };
  });

  // --- Prompting (per-tab) ---
  handle("pi:prompt", async (a) => { const m = await mgr(a); return m.prompt(a.message, a); });
  handle("pi:steer", async (a) => { const m = await mgr(a); return m.steer(a.message, a.images); });
  handle("pi:followUp", async (a) => { const m = await mgr(a); return m.followUp(a.message, a.images); });
  handle("pi:abort", async (a) => { const m = await mgr(a); return m.abort(); });
  handle("pi:queue.remove", async (a) => { const m = await mgr(a); return m.removeQueuedItem(a.kind, a.index); });
  handle("pi:convertToCode", async (a) => { const m = await mgr(a); return m.convertToCode(a.cwd); });
  handle("pi:chat.setWeb", async (a) => { const m = await mgr(a); return m.setWebEnabled(!!a.enabled); });

  // --- Web search config (~/.pi/web-search.json) ---
  handle("pi:webSearch.status", () => getWebSearchStatus());
  handle("pi:webSearch.set", (a) => setWebSearchConfig(a ?? {}));

  // --- Extension detail + settings (per-extension panel) ---
  handle("packages:detail", (a) => getExtensionDetail(a?.source));
  handle("packages:settings.set", (a) => setExtensionConfig(a?.key, a?.values ?? {}));

  // --- Session (per-tab) ---
  handle("pi:session.new", async (a) => { const m = await mgr(a); return m.newSession(a?.parentSession, a?.cwd); });
  handle("pi:session.switch", async (a) => { const m = await mgr(a); return m.switchSession(a.sessionPath, a?.cwd); });
  handle("pi:session.fork", async (a) => { const m = await mgr(a); return m.fork(a.entryId); });
  handle("pi:session.clone", async (a) => { const m = await mgr(a); return m.clone(); });
  handle("pi:session.list", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.listSessions();
  });
  handle("pi:session.listAll", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.listAllSessions();
  });
  handle("pi:session.tree", async (a) => { const m = await mgr(a); return m.getSessionTree(); });
  handle("pi:session.forkMessages", async (a) => { const m = await mgr(a); return m.getForkMessages(); });
  handle("pi:messages", async (a) => {
    const m = await mgr(a);
    const sessionFile = m.session?.sessionFile;
    // Check message cache first for instant loads.
    if (sessionFile) {
      const cached = getCachedMessages(sessionFile);
      if (cached) return cached;
    }
    const msgs = m.getMessages();
    if (sessionFile && msgs.length > 0) {
      setCachedMessages(sessionFile, msgs);
    }
    return msgs;
  });
  handle("pi:state", async (a) => { const m = await mgr(a); return m.getState(); });
  handle("pi:stats", async (a) => { const m = await mgr(a); return m.getSessionStats(); });

  // --- Model & thinking (per-tab) ---
  handle("pi:model.set", async (a) => { const m = await mgr(a); return m.setModel(a.provider, a.modelId); });
  handle("pi:model.cycle", async (a) => { const m = await mgr(a); return m.cycleModel(); });
  handle("pi:model.available", async (a) => { const m = await mgr(a); return m.getAvailableModels(); });
  handle("pi:thinking.set", async (a) => { const m = await mgr(a); return m.setThinkingLevel(a.level); });
  handle("pi:thinking.cycle", async (a) => { const m = await mgr(a); return m.cycleThinkingLevel(); });

  // --- Custom models (models.json management) ---
  handle("pi:models.custom.list", () => listCustomModels());
  handle("pi:models.custom.add", async (a) => {
    const result = addCustomModel(a);
    if (result.success) {
      invalidateSharedDeps();
    }
    return result;
  });
  handle("pi:models.custom.remove", async (a) => {
    const result = removeCustomModel(a.provider, a.modelId);
    if (result.success) {
      invalidateSharedDeps();
    }
    return result;
  });
  handle("pi:models.json.path", () => getModelsPath());
  handle("pi:models.json.open", () => {
    shell.showItemInFolder(getModelsPath());
    return { success: true };
  });

  // --- Compaction (per-tab) ---
  handle("pi:compact", async (a) => { const m = await mgr(a); return m.compact(a?.customInstructions); });
  handle("pi:compact.abort", async (a) => { const m = await mgr(a); return m.abortCompaction(); });
  handle("pi:autoCompaction", async (a) => { const m = await mgr(a); return m.setAutoCompaction(!!a?.enabled); });

  // --- Auth (shared, not per-tab) ---
  handle("pi:auth.status", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.getAuthStatus();
  });
  handle("pi:auth.setApiKey", async (a) => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.setApiKey(a.provider, a.apiKey);
  });
  handle("pi:auth.logout", async (a) => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.logout(a.provider);
  });

  // --- Settings (shared) ---
  handle("pi:settings.get", async () => {
    const pi = await import("@earendil-works/pi-coding-agent");
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    const sm = pi.SettingsManager.create(m.cwd, m.agentDir);
    return { global: sm.getGlobalSettings(), project: sm.getProjectSettings() };
  });
  handle("pi:settings.set", async (a) => {
    const m = pool.get();
    m?.deps?.settingsManager?.applyOverrides(a.settings);
    return { success: true };
  });

  // --- Extensions / skills / themes / commands (shared) ---
  handle("pi:extensions", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.getExtensions();
  });
  handle("pi:skills", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.getSkills();
  });
  handle("pi:themes", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.getThemes();
  });
  handle("pi:commands", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.getCommands();
  });
  handle("pi:tools", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.getTools();
  });
  handle("pi:session.rename", async (a) => { const m = await mgr(a); return m.renameSession(a.name); });
  handle("pi:session.exportHtml", async (a) => { const m = await mgr(a); return m.exportHtml(a?.outputPath); });

  // --- Cwd ---
  handle("pi:cwd.get", async () => {
    const m = pool.get() ?? (await pool.getOrCreate(pool.getActiveTab()!));
    return m.getCwd();
  });
  handle("pi:cwd.set", async (a) => { const m = await mgr(a); return m.setCwd(a.cwd); });
  handle("pi:pickDirectory", async () => {
    const win = getMainWindow();
    const res = win
      ? await dialog.showOpenDialog(win, { properties: ["openDirectory"] })
      : { canceled: true, filePaths: [] };
    return res.canceled ? null : res.filePaths[0] ?? null;
  });

  // --- Extension UI (status / widgets / dialogs from extensions) ---
  handle("pi:extui.respond", async (a) => {
    const m = await mgr(a);
    return m.resolveDialog(a.id, a.response);
  });

  // --- Git repository info ---
  handle("pi:git.info", async (a) => {
    const m = await mgr(a);
    const cwd = m.getCwd();
    return getGitInfo(cwd);
  });

  // --- Pi CLI install ---
  handle("pi:install.check", async () => {
    return { installed: isPiInstalled(), version: getPiVersion() };
  });
  handle("pi:system.check", async () => {
    const { execSync } = await import("child_process");
    const check = (cmd: string) => {
      try {
        execSync(`${cmd} --version`, { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
        return true;
      } catch {
        return false;
      }
    };
    return {
      npm: check("npm"),
      node: check("node"),
      git: check("git"),
      pi: check("pi"),
    };
  });

  handle("pi:install.start", async () => {
    const installer = installPi();
    installer.on("progress", (progress: any) => {
      send("pi:install.progress", progress);
    });
    const result = await installer;
    send("pi:install.done", result);
    return result;
  });

  // --- GitHub auth ---
  handle("github:auth.status", async () => {
    return getGitHubAuthStatus();
  });

  handle("github:auth.verify", async (a) => {
    const token = a?.token;
    if (!token) return { authenticated: false, error: "No token provided" };
    const result = await verifyToken(token);
    if (result.authenticated) {
      storeGitHubToken(token);
    }
    return result;
  });

  handle("github:auth.logout", async () => {
    clearGitHubToken();
    return { success: true };
  });

  // --- GitHub sync ---
  handle("github:sync.state", async (a) => {
    const m = await mgr(a);
    const cwd = m.getCwd();
    // fetch defaults to true; renderer passes fetch:false for cheap local polling.
    return getSyncState(cwd, a?.fetch !== false);
  });

  handle("github:sync.push", async (a) => {
    const m = await mgr(a);
    const cwd = m.getCwd();
    return pushToRemote(cwd);
  });

  handle("github:sync.pull", async (a) => {
    const m = await mgr(a);
    const cwd = m.getCwd();
    return pullFromRemote(cwd);
  });

  handle("github:repo.create", async (a) => {
    const m = await mgr(a);
    const cwd = m.getCwd();
    const token = getGitHubToken();
    if (!token) return { success: false, error: "Not authenticated" };
    return createRepo(cwd, token, { name: a?.name, private: a?.private ?? true, description: a?.description });
  });

  handle("github:repo.list", async () => {
    const token = getGitHubToken();
    if (!token) return [];
    return listUserRepos(token);
  });

  handle("github:repo.attach", async (a) => {
    const m = await mgr(a);
    const cwd = m.getCwd();
    return attachRepo(cwd, { owner: a?.owner, name: a?.name, remoteUrl: a?.remoteUrl });
  });

  handle("github:repo.clone", async (a) => {
    return cloneRepo(a?.remoteUrl, a?.localPath);
  });

  handle("github:repo.linkage", async (a) => {
    const m = await mgr(a);
    const cwd = m.getCwd();
    return readRepoLinkage(cwd);
  });

  // --- Packages (SDK-based, no pi CLI required) ---
  handle("packages:search", async () => {
    const packages = await searchPackages();
    // Enrich with download counts.
    const names = packages.map((p) => p.name);
    const downloads = await getDownloadCounts(names);
    for (const pkg of packages) {
      if (downloads[pkg.name]) pkg.downloads = downloads[pkg.name];
    }
    return packages;
  });

  handle("packages:installed", async (a) => {
    const m = await mgr(a);
    return m.listPackages();
  });

  handle("packages:install", async (a) => {
    const m = await mgr(a);
    const result = await m.installPackage(a?.spec);
    invalidateSharedDeps();
    send("packages:installed.changed", {});
    return result;
  });

  handle("packages:remove", async (a) => {
    const m = await mgr(a);
    const result = await m.removePackage(a?.spec);
    invalidateSharedDeps();
    send("packages:installed.changed", {});
    return result;
  });

  // --- Skill / Extension removal ---
  handle("pi:skill.remove", async (a) => {
    const m = await mgr(a);
    const result = await m.removeSkill(a?.path);
    invalidateSharedDeps();
    send("packages:installed.changed", {});
    return result;
  });
  handle("pi:extension.remove", async (a) => {
    const m = await mgr(a);
    const result = await m.removeExtension(a?.path);
    invalidateSharedDeps();
    send("packages:installed.changed", {});
    return result;
  });

  // --- Restore to stock ---
  handle("pi:restoreStock", async () => {
    const m = await mgr({});
    const result = await m.restoreToStock();
    invalidateSharedDeps();
    send("packages:installed.changed", {});
    return result;
  });
}
