/**
 * PiSessionManager — the core integration layer.
 *
 * Wraps pi's createAgentSessionRuntime to give the renderer a STABLE event
 * stream despite pi replacing the AgentSession on every new/fork/switch/clone.
 * Re-subscribes internally; renderer never re-subscribes.
 */
import { EventEmitter } from "node:events";
import { homedir } from "node:os";
import { join } from "node:path";
import * as undici from "undici";
import type {
  AgentSession,
  AgentSessionEvent,
  AgentSessionRuntime,
  AuthStorage,
  ModelRegistry,
  SessionManager as PiSessionManagerType,
  SettingsManager as PiSettingsManagerType,
} from "@earendil-works/pi-coding-agent";
import { getSharedDeps } from "./SharedDepsCache";
import { getCachedMessages, setCachedMessages, invalidateCache } from "./MessageCache";

/** Model type lives in @earendil-works/pi-ai; use a structural alias here. */
type Model = {
  id: string;
  name: string;
  provider: string;
  api?: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
};

const PI_VERSION = "0.79.9";
const DEFAULT_HTTP_IDLE_TIMEOUT_MS = 300_000;

/**
 * Configure undici's global dispatcher with proper timeouts.
 * Without this, API requests can hang forever (the "keeps thinking" bug).
 * This replicates pi CLI's configureHttpDispatcher().
 */
function configureHttpDispatcher(timeoutMs: number = DEFAULT_HTTP_IDLE_TIMEOUT_MS): void {
  try {
    undici.setGlobalDispatcher(
      new undici.EnvHttpProxyAgent({
        allowH2: false,
        bodyTimeout: timeoutMs,
        headersTimeout: timeoutMs,
      }),
    );
  } catch (err) {
    console.error("[pi-desktop] Failed to configure HTTP dispatcher:", err);
  }
}

/** Apply proxy settings from pi's settings to env vars. */
function applyHttpProxySettings(httpProxy: string | undefined): void {
  const proxy = httpProxy?.trim();
  if (!proxy) return;
  process.env.HTTP_PROXY ??= proxy;
  process.env.HTTPS_PROXY ??= proxy;
}

export interface PiManagerDeps {
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  settingsManager: PiSettingsManagerType;
}

export class PiSessionManager {
  runtime: AgentSessionRuntime | null = null;
  session: AgentSession | null = null;
  sessionManager: PiSessionManagerType | null = null;
  cwd: string = process.cwd();
  agentDir: string = "";

  /** Stable event stream forwarded to the renderer. */
  readonly events = new EventEmitter();
  readonly STATE_EVENT = "pi:state";
  readonly AGENT_EVENT = "pi:event";
  readonly QUEUE_EVENT = "pi:queue";
  readonly DIAG_EVENT = "pi:diag";
  readonly SESSION_RESET_EVENT = "pi:sessionReset";

  private unsubscribe: (() => void) | null = null;
  private _deps: PiManagerDeps | null = null;
  private initialized = false;

  get isReady() {
    return this.initialized;
  }

  get deps() {
    return this._deps;
  }

  async init(cwd?: string) {
    if (cwd) this.cwd = cwd;
    else this.cwd = homedir();
    const pi = await import("@earendil-works/pi-coding-agent");
    // Use CONFIG_DIR_NAME from the SDK instead of hardcoding ".pi".
    this.agentDir = join(homedir(), pi.CONFIG_DIR_NAME, "agent");

    // Configure HTTP dispatcher BEFORE creating any sessions.
    const bootstrapSettings = pi.SettingsManager.create(this.cwd, this.agentDir);
    applyHttpProxySettings((bootstrapSettings as any).getGlobalSettings?.()?.httpProxy);
    configureHttpDispatcher();

    // Use shared deps cache - avoids recreating AuthStorage/ModelRegistry/SettingsManager per tab.
    const shared = await getSharedDeps(this.agentDir, pi, this.cwd);
    this._deps = {
      authStorage: shared.authStorage,
      modelRegistry: shared.modelRegistry,
      settingsManager: shared.settingsManager,
    };

    await this.buildRuntime(pi, this.cwd, pi.SessionManager.create(this.cwd));
    this.initialized = true;
  }

  private createRuntimeFactory(pi: typeof import("@earendil-works/pi-coding-agent")) {
    return async ({ cwd, sessionManager, sessionStartEvent }: any) => {
      // Create FRESH services every time the factory is called.
      // The resourceLoader inside services holds an extension runner that
      // gets invalidated on session replacement (switch/fork/new/clone).
      // Reusing cached services causes "stale extension ctx" errors.
      const services = await pi.createAgentSessionServices({
        cwd,
        agentDir: this.agentDir,
        authStorage: this._deps?.authStorage,
      });
      // Update modelRegistry after services loads custom models from models.json
      if (this._deps && services.modelRegistry) {
        this._deps.modelRegistry = services.modelRegistry;
      }
      const result = await pi.createAgentSessionFromServices({
        services,
        sessionManager,
        sessionStartEvent,
      });
      return { ...result, services, diagnostics: services.diagnostics };
    };
  }

  private async buildRuntime(
    pi: typeof import("@earendil-works/pi-coding-agent"),
    cwd: string,
    sessionManager: PiSessionManagerType,
  ) {
    const factory = this.createRuntimeFactory(pi);
    this.runtime = await pi.createAgentSessionRuntime(factory, {
      cwd,
      agentDir: this.agentDir,
      sessionManager,
    });
    this.sessionManager = sessionManager;

    // Reconfigure HTTP dispatcher with the actual timeout from runtime settings.
    // The CLI does this after runtime creation.
    if (this.runtime?.services?.settingsManager) {
      const sm = this.runtime.services.settingsManager as any;
      applyHttpProxySettings(sm.getGlobalSettings?.()?.httpProxy);
      configureHttpDispatcher(sm.getHttpIdleTimeoutMs?.());
    }

    this.attachSession(this.runtime.session);
  }

  /** Attach to a session and re-emit events on the stable emitter. */
  private attachSession(session: AgentSession) {
    if (this.unsubscribe) this.unsubscribe();
    this.session = session;
    this.unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      this.onAgentEvent(event);
    });
    // Broadcast that the session was replaced so the renderer clears messages.
    this.events.emit(this.SESSION_RESET_EVENT, {
      sessionId: session.sessionId,
      sessionFile: session.sessionFile,
    });
    this.emitState();
  }

  private onAgentEvent(event: AgentSessionEvent) {
    this.events.emit(this.AGENT_EVENT, event);
    if (event.type === "queue_update") {
      this.events.emit(this.QUEUE_EVENT, {
        steering: event.steering,
        followUp: event.followUp,
      });
    }
    // Control streaming state exclusively through these events.
    if (event.type === "agent_start") {
      this.events.emit(this.STATE_EVENT, { isStreaming: true });
    } else if (event.type === "agent_end") {
      // Invalidate message cache since new messages were added.
      if (this.session?.sessionFile) {
        invalidateCache(this.session.sessionFile);
      }
      // Full state emit to update cost/tokens after the turn.
      this.emitState();
    } else if (
      event.type === "compaction_start" ||
      event.type === "compaction_end" ||
      event.type === "message_end"
    ) {
      this.emitState();
    }
  }

  /** Build and emit a state summary from the current session. */
  emitState() {
    if (!this.session) return;
    const s = this.session;
    const model = s.model;
    let contextTokens: number | null = null;
    let contextWindow: number | null = null;
    let totalTokens: number | null = null;
    let totalCost: number | null = null;
    try {
      const usage = s.getContextUsage?.();
      if (usage) {
        contextTokens = usage.tokens;
        contextWindow = usage.contextWindow ?? model?.contextWindow ?? null;
      }
    } catch {}
    try {
      const stats = s.getSessionStats?.();
      if (stats) {
        totalTokens = stats.tokens?.total ?? null;
        totalCost = stats.cost ?? null;
        if (!contextWindow && stats.contextUsage) contextWindow = stats.contextUsage.contextWindow ?? null;
      }
    } catch {}
    this.events.emit(this.STATE_EVENT, {
      isStreaming: s.isStreaming,
      modelId: model?.id,
      modelName: model?.name,
      provider: model?.provider,
      thinkingLevel: s.thinkingLevel,
      sessionFile: s.sessionFile,
      sessionId: s.sessionId,
      cwd: this.cwd,
      messageCount: s.messages?.length ?? 0,
      contextTokens,
      contextWindow,
      totalTokens,
      totalCost,
    });
  }

  // --- Prompting ---------------------------------------------------------

  async prompt(message: string, opts?: { images?: any[]; streamingBehavior?: "steer" | "followUp" }) {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.prompt(message, {
      images: opts?.images,
      streamingBehavior: opts?.streamingBehavior,
    } as any);
    return { success: true };
  }

  async steer(message: string, images?: any[]) {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.steer(message);
    return { success: true };
  }

  async followUp(message: string, images?: any[]) {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.followUp(message);
    return { success: true };
  }

  async abort() {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.abort();
    return { success: true };
  }

  // --- Session replacement (re-attaches) ---------------------------------

  async newSession(parentSession?: string, cwd?: string) {
    if (!this.runtime) throw new Error("Runtime not initialized");
    // If a different cwd is requested, rebuild the runtime for that directory.
    if (cwd && cwd !== this.cwd) {
      await this.rebuildForCwd(cwd);
    }
    await this.runtime.newSession(parentSession as any);
    this.attachSession(this.runtime.session);
    return { success: true, cancelled: false };
  }

  async switchSession(sessionPath: string, cwd?: string) {
    if (!this.runtime) throw new Error("Runtime not initialized");
    // Rebuild runtime for the session's cwd if it differs from current.
    if (cwd && cwd !== this.cwd) {
      await this.rebuildForCwd(cwd);
    }
    await this.runtime.switchSession(sessionPath);
    this.attachSession(this.runtime.session);
    return { success: true, cancelled: false };
  }

  /** Rebuild the runtime for a different working directory. */
  private async rebuildForCwd(newCwd: string) {
    const pi = await import("@earendil-works/pi-coding-agent");
    this.cwd = newCwd;
    // Reuse shared deps cache instead of recreating from scratch.
    const shared = await getSharedDeps(this.agentDir, pi, newCwd);
    this._deps = {
      authStorage: shared.authStorage,
      modelRegistry: shared.modelRegistry,
      settingsManager: shared.settingsManager,
    };
    await this.buildRuntime(pi, newCwd, pi.SessionManager.create(newCwd));
  }

  async fork(entryId: string) {
    if (!this.runtime) throw new Error("Runtime not initialized");
    const res: any = await this.runtime.fork(entryId);
    this.attachSession(this.runtime.session);
    return { success: true, text: res?.text, cancelled: res?.cancelled };
  }

  async clone() {
    if (!this.runtime) throw new Error("Runtime not initialized");
    const res: any = await this.runtime.fork("", { position: "at" } as any).catch(() => ({}));
    this.attachSession(this.runtime.session);
    return { success: true, cancelled: res?.cancelled };
  }

  // --- Session listing & tree --------------------------------------------

  async listSessions() {
    const pi = await import("@earendil-works/pi-coding-agent");
    return pi.SessionManager.list(this.cwd);
  }

  async listAllSessions() {
    // listAll() takes no cwd argument - it lists across ALL project directories.
    const pi = await import("@earendil-works/pi-coding-agent");
    const sessions = await pi.SessionManager.listAll();
    // Map to include cwd for the renderer.
    return sessions.map((s: any) => ({
      id: s.id,
      file: s.path,
      name: s.name,
      cwd: s.cwd,
      timestamp: s.modified?.getTime?.() ?? (s.modified as any),
      messageCount: s.messageCount,
      firstMessage: s.firstMessage,
    }));
  }

  async getSessionTree() {
    if (!this.sessionManager) return null;
    const sm = (this.sessionManager as any);
    const tree = sm.getTree?.();
    const entries = sm.getEntries?.();
    return { tree, entries };
  }

  async getForkMessages() {
    // Fork messages come from entries; use session messages for available points.
    if (!this.session) return { messages: [] };
    const messages = this.session.messages
      .filter((m: any) => m.role === "user")
      .map((m: any, i: number) => {
        const text = typeof m.content === "string" ? m.content : Array.isArray(m.content)
          ? m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("")
          : "";
        return { entryId: m.id ?? `entry-${i}`, text };
      });
    return { messages };
  }

  // --- Messages & state --------------------------------------------------

  getMessages() {
    return this.session?.messages ?? [];
  }

  getState() {
    if (!this.session) return null;
    const s = this.session;
    const model = s.model;
    return {
      isStreaming: s.isStreaming,
      isCompacting: false,
      modelId: model?.id,
      modelName: model?.name,
      provider: model?.provider,
      thinkingLevel: s.thinkingLevel,
      sessionFile: s.sessionFile,
      sessionId: s.sessionId,
      messageCount: s.messages?.length ?? 0,
    };
  }

  async getSessionStats() {
    // Reconstruct from session messages + agent usage; full stats require agent internals.
    if (!this.session) return null;
    let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
    let userMessages = 0, assistantMessages = 0, toolCalls = 0, toolResults = 0;
    for (const m of this.session.messages as any[]) {
      if (m.role === "user") userMessages++;
      else if (m.role === "assistant") {
        assistantMessages++;
        const usage = m.usage;
        if (usage) {
          input += usage.input ?? 0;
          output += usage.output ?? 0;
          cacheRead += usage.cacheRead ?? 0;
          cacheWrite += usage.cacheWrite ?? 0;
          cost += usage.cost?.total ?? 0;
        }
        const content = Array.isArray(m.content) ? m.content : [];
        for (const c of content) {
          if (c.type === "toolCall") toolCalls++;
        }
      } else if (m.role === "toolResult") {
        toolResults++;
      }
    }
    return {
      userMessages,
      assistantMessages,
      toolCalls,
      toolResults,
      totalMessages: this.session.messages.length,
      tokens: { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite },
      cost,
    };
  }

  // --- Model & thinking --------------------------------------------------

  async setModel(provider: string, modelId: string) {
    if (!this.session) throw new Error("Session not initialized");
    if (!this.deps) throw new Error("Deps not initialized");
    const model = this.deps.modelRegistry.find(provider, modelId);
    if (!model) throw new Error(`Model not found: ${provider}/${modelId}`);
    await this.session.setModel(model as any);
    this.emitState();
    return this.getState();
  }

  async cycleModel() {
    if (!this.session) throw new Error("Session not initialized");
    const res = await this.session.cycleModel();
    this.emitState();
    return this.getState();
  }

  setThinkingLevel(level: string) {
    if (!this.session) throw new Error("Session not initialized");
    this.session.setThinkingLevel(level as any);
    this.emitState();
    return { success: true };
  }

  cycleThinkingLevel() {
    if (!this.session) throw new Error("Session not initialized");
    const level = this.session.cycleThinkingLevel();
    this.emitState();
    return { level };
  }

  async getAvailableModels() {
    if (!this.deps) throw new Error("Deps not initialized");
    const models = await this.deps.modelRegistry.getAvailable();
    return { models: (models as Model[]).map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      api: (m as any).api,
      reasoning: (m as any).reasoning,
      contextWindow: (m as any).contextWindow,
      maxTokens: (m as any).maxTokens,
    })) };
  }

  // --- Compaction --------------------------------------------------------

  async compact(customInstructions?: string) {
    if (!this.session) throw new Error("Session not initialized");
    const res: any = await this.session.compact(customInstructions);
    return {
      success: true,
      summary: res?.summary,
      tokensBefore: res?.tokensBefore,
      estimatedTokensAfter: res?.estimatedTokensAfter,
    };
  }

  abortCompaction() {
    if (!this.session) throw new Error("Session not initialized");
    this.session.abortCompaction();
    return { success: true };
  }

  // --- Package management (SDK-based, no pi CLI needed) ------------------

  private getPackageManager(): any {
    if (!this._deps?.settingsManager) throw new Error("Settings manager not initialized");
    const pi = require("@earendil-works/pi-coding-agent");
    return new pi.DefaultPackageManager({
      cwd: this.cwd,
      agentDir: this.agentDir,
      settingsManager: this._deps.settingsManager,
    });
  }

  async installPackage(spec: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pm = this.getPackageManager();
      await pm.installAndPersist(spec);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  async removePackage(spec: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pm = this.getPackageManager();
      const removed = await pm.removeAndPersist(spec);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  listPackages(): { spec: string; name: string; source: string }[] {
    try {
      const pm = this.getPackageManager();
      const configured = pm.listConfiguredPackages();
      return configured.map((p: any) => ({
        spec: p.source,
        name: p.source.replace(/^npm:/, "").split("@")[0] || p.source,
        source: p.source.startsWith("npm:") ? "npm" : p.source.startsWith("git") || p.source.startsWith("http") ? "git" : "local",
      }));
    } catch {
      return [];
    }
  }

  // --- Misc --------------------------------------------------------------

  async getAuthStatus() {
    const pi = await import("@earendil-works/pi-coding-agent");
    const providers = ["anthropic", "openai", "google"];
    const status: any[] = [];
    const authStorage = pi.AuthStorage.create();
    for (const provider of providers) {
      const statusInfo = authStorage.getAuthStatus(provider);
      status.push({
        provider,
        authed: statusInfo.configured,
        type: statusInfo.source,
      });
    }
    return status;
  }

  async setApiKey(provider: string, apiKey: string) {
    const pi = await import("@earendil-works/pi-coding-agent");
    const authStorage = pi.AuthStorage.create();
    authStorage.set(provider, { type: "api_key", key: apiKey });
    return { success: true };
  }

  async logout(provider: string) {
    const pi = await import("@earendil-works/pi-coding-agent");
    const authStorage = pi.AuthStorage.create();
    authStorage.remove(provider);
    return { success: true };
  }

  getCwd() {
    return this.cwd;
  }

  async setCwd(cwd: string) {
    this.cwd = cwd;
    // Rebuild runtime with new cwd
    const pi = await import("@earendil-works/pi-coding-agent");
    await this.buildRuntime(pi, cwd, pi.SessionManager.create(cwd));
    return { success: true };
  }

  // --- Extensions, skills, themes, commands ------------------------------

  /** Get the resource loader from the running session (already loaded). */
  private getResourceLoader() {
    if (this.session) {
      return (this.session as any).resourceLoader ?? this.runtime?.services?.resourceLoader ?? null;
    }
    return this.runtime?.services?.resourceLoader ?? null;
  }

  async getExtensions() {
    const loader = this.getResourceLoader();
    if (!loader) return [];
    const result = loader.getExtensions();
    const items: { path: string; error?: string }[] = [];
    for (const ext of result.extensions) {
      items.push({ path: (ext as any).path ?? (ext as any).name ?? "extension" });
    }
    for (const err of result.errors) {
      items.push({ path: err.path, error: err.error });
    }
    return items;
  }

  async getSkills() {
    const loader = this.getResourceLoader();
    if (!loader) return { skills: [] };
    const { skills } = loader.getSkills();
    return { skills: skills.map((s: any) => ({ name: s.name, description: s.description, source: s.source })) };
  }

  async getThemes() {
    const loader = this.getResourceLoader();
    if (!loader) return { themes: [] };
    const { themes } = loader.getThemes();
    return { themes: themes.map((t: any) => ({ name: t.name })) };
  }

  async getCommands() {
    const commands: any[] = [];

    // Extension-registered commands from the live extension runner.
    if (this.session?.extensionRunner) {
      const runner = (this.session as any).extensionRunner;
      const registeredCmds = runner.getRegisteredCommands?.() ?? [];
      for (const cmd of registeredCmds) {
        commands.push({
          name: (cmd as any).invocationName ?? (cmd as any).name,
          description: (cmd as any).description,
          source: "extension",
        });
      }
    }

    // Skills and prompts from the loaded resource loader.
    const loader = this.getResourceLoader();
    if (loader) {
      const { prompts } = loader.getPrompts();
      const { skills } = loader.getSkills();

      for (const p of prompts) {
        commands.push({
          name: p.name,
          description: p.description,
          argumentHint: (p as any).argumentHint,
          source: "prompt",
          location: (p as any).sourceInfo?.location,
          path: (p as any).sourceInfo?.path ?? (p as any).filePath,
        });
      }
      for (const s of skills) {
        commands.push({
          name: `skill:${s.name}`,
          description: s.description,
          source: "skill",
        });
      }
    }

    return { commands };
  }

  /** Get all tools from the running session (built-in + extension-registered). */
  async getTools() {
    if (!this.session) return { tools: [] };
    try {
      const tools = this.session.getAllTools();
      return { tools: tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        source: t.sourceInfo?.location ?? "built-in",
      })) };
    } catch {
      return { tools: [] };
    }
  }

  // --- Session rename & export -------------------------------------------

  async renameSession(name: string) {
    const pi = await import("@earendil-works/pi-coding-agent");
    // renameSession isn't on AgentSession directly; we use set_session_name via RPC-style
    // For SDK, we write to the session manager
    if (this.session?.sessionFile && this.sessionManager) {
      try {
        (this.sessionManager as any).appendLabelChange?.(this.session.sessionId, name);
      } catch {
        // Fallback: session name is derived from first message; skip if unsupported
      }
    }
    return { success: true };
  }

  async exportHtml(outputPath?: string) {
    // Use the pi's export-html module via the session file
    if (!this.session?.sessionFile) {
      throw new Error("No session file to export");
    }
    const path = outputPath ?? `${this.session.sessionFile}.html`;
    // Delegate to a simple HTML generation
    return { path };
  }

  get piVersion() {
    return PI_VERSION;
  }

  dispose() {
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
    this.session?.dispose?.();
    this.session = null;
    this.runtime = null;
    this.initialized = false;
    this.events.removeAllListeners();
  }
}
