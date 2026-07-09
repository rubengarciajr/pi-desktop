/**
 * PiSessionManager — the core integration layer.
 *
 * Wraps pi's createAgentSessionRuntime to give the renderer a STABLE event
 * stream despite pi replacing the AgentSession on every new/fork/switch/clone.
 * Re-subscribes internally; renderer never re-subscribes.
 */
import { EventEmitter } from "node:events";
import { mkdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { shell } from "electron";
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
import { getSharedDeps, invalidateSharedDeps } from "./SharedDepsCache";
import { listCustomProviderCredentials } from "../models";
import { invalidateCache } from "./MessageCache";
import {
  createExtensionUiBridge,
  type ExtUiDialogRequest,
  type ExtUiDialogResponse,
} from "./ExtensionUiBridge";
import { createNativeWebSearchTool } from "../webSearchTool";

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

/** Web-search tools (from the pi-web-access package) allowed in chat mode when
 *  the 🔍 Web toggle is on. Unknown names are harmless no-ops if the package
 *  isn't installed. */
const CHAT_WEB_TOOLS = ["web_search", "fetch_content", "get_search_content", "code_search"];

/** Built-in Pi tools enabled in chat when the "Tools" toggle is on. */
const CHAT_NATIVE_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"];
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

// --- Chat → code conversion helpers ------------------------------------------

/** Flatten an AgentMessage's content to plain text (text blocks only). */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c?.type === "text" && typeof c.text === "string")
      .map((c: any) => c.text)
      .join("\n");
  }
  return "";
}

/** Human-readable Markdown transcript written to <folder>/docs/chat-<ts>.md. */
function serializeTranscript(messages: any[], cwd: string, timestamp: string): string {
  const lines: string[] = [
    "# Chat Transcript",
    "",
    `- Exported: ${timestamp}`,
    `- Converted to code session in: \`${cwd}\``,
    "",
    "---",
    "",
  ];
  for (const m of messages) {
    if (m?.role === "user") {
      const text = contentToText(m.content);
      if (text.trim()) lines.push("## User", "", text, "");
    } else if (m?.role === "assistant") {
      const text = contentToText(m.content);
      if (text.trim()) lines.push("## Assistant", "", text, "");
    }
  }
  return lines.join("\n");
}

/** Compact context primer seeded into the new code session so the agent
 *  remembers the chat (chat mode is text-only, so this is just user/assistant
 *  turns). */
function buildSeedContextMessage(messages: any[], mdPath: string): string {
  const body = messages
    .map((m: any) =>
      m?.role === "user"
        ? `User: ${contentToText(m.content)}`
        : m?.role === "assistant"
          ? `Assistant: ${contentToText(m.content)}`
          : "",
    )
    .filter((s) => s.trim())
    .join("\n\n");
  return [
    "We are continuing a conversation that started in chat mode and is now a code session in this folder.",
    `The full transcript is saved at ${mdPath}.`,
    "Use the conversation below as context. Do not repeat it back unless asked.",
    "",
    "--- BEGIN PRIOR CONVERSATION ---",
    body,
    "--- END PRIOR CONVERSATION ---",
  ].join("\n");
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
  /** Extension-driven UI (status badges, widgets, dialogs, toasts). */
  readonly EXT_UI_EVENT = "pi:extui";
  /** OAuth login flow events (open browser, show device code, prompt for input). */
  readonly AUTH_EVENT = "pi:auth.event";

  private unsubscribe: (() => void) | null = null;
  private _deps: PiManagerDeps | null = null;
  private initialized = false;
  private isCompacting = false;

  /** Blocking extension dialogs awaiting a renderer response, keyed by id. */
  private pendingDialogs = new Map<string, (response: ExtUiDialogResponse) => void>();
  private dialogSeq = 0;
  /** Blocking OAuth prompts (onPrompt/onSelect/onManualCodeInput) awaiting the
   *  renderer's reply, keyed by id. Mirrors pendingDialogs. */
  private pendingAuthPrompts = new Map<string, (response: string | undefined) => void>();
  private authPromptSeq = 0;
  /** UI adapter handed to Pi's extension runner. Built once, reused per session. */
  private readonly uiBridge = createExtensionUiBridge({
    emit: (message) => this.events.emit(this.EXT_UI_EVENT, message),
    registerDialog: (request, map, fallback) =>
      new Promise((resolve) => {
        const id = `dlg-${++this.dialogSeq}`;
        this.pendingDialogs.set(id, (response) => {
          try {
            resolve(map(response));
          } catch {
            resolve(fallback);
          }
        });
        this.events.emit(this.EXT_UI_EVENT, {
          kind: "request",
          request: { ...request, id } as ExtUiDialogRequest,
        });
      }),
  });

  constructor() {
    // Pool wiring (5 listeners) plus headroom; surfaces real leaks without
    // tripping the default 10-listener warning during normal operation.
    this.events.setMaxListeners(50);
  }

  /** Resolve a pending extension dialog with the renderer's answer. */
  resolveDialog(id: string, response: ExtUiDialogResponse) {
    const resolve = this.pendingDialogs.get(id);
    if (resolve) {
      this.pendingDialogs.delete(id);
      resolve(response);
    }
    return { success: true };
  }

  /** Resolve a pending OAuth prompt with the renderer's answer (a string for
   *  onPrompt/onManualCodeInput, or an option id for onSelect; undefined cancels). */
  resolveAuthPrompt(id: string, value: string | undefined) {
    const resolve = this.pendingAuthPrompts.get(id);
    if (resolve) {
      this.pendingAuthPrompts.delete(id);
      resolve(value);
    }
    return { success: true };
  }

  /** Cancel every pending dialog (on session swap / dispose) so extensions don't hang. */
  private cancelPendingDialogs() {
    for (const resolve of this.pendingDialogs.values()) resolve({ cancelled: true });
    this.pendingDialogs.clear();
    // OAuth prompts too — resolve as cancelled so the login promise rejects cleanly.
    for (const resolve of this.pendingAuthPrompts.values()) resolve(undefined);
    this.pendingAuthPrompts.clear();
  }

  /** Chat mode = pure conversation: no file/bash tools, runs in a scratch dir. */
  chatMode = false;
  /** In chat mode, whether the web-search tools are enabled (🔍 toggle). */
  webEnabled = false;
  /** In chat mode, whether the native Pi tools (read/bash/edit/…) are enabled. */
  toolsEnabled = false;
  /** Pi Routing: when true, prompts are pre-processed by an MOA team. */
  routingEnabled = false;
  /** The MOA team id to use for routing (resolved from config at prompt time). */
  routingTeamId: string | null = null;
  /** Tag Team: when true, after the starter model finishes, the next stage's
   *  model takes over in a new tab (sequential relay). */
  tagTeamEnabled = false;
  /** The Tag Team id to use for the relay. */
  tagTeamTeamId: string | null = null;
  /** Which relay stage THIS session represents (0 = starter). When this session
   *  finishes a turn, it hands off to stage `tagTeamStageIndex + 1` if one exists. */
  tagTeamStageIndex = 0;
  /**
   * Callback set by SessionPool to create a new tab for the next Tag Team
   * stage. Receives the source tab's cwd, the next model spec, the previous
   * model's output, and the handoff prompt. Returns the new tab's id.
   * If null, Tag Team handoff is unavailable (pool not wired).
   */
  tagTeamHandoffCallback: ((opts: {
    cwd?: string;
    teamId: string;
    provider: string;
    modelId: string;
    previousOutput: string;
    handoffPrompt: string;
    fromModelName: string;
    toModelName: string;
    teamName: string;
    fromStage: number;
    toStage: number;
    /** True when a stage exists after `toStage`, so the new tab keeps relaying. */
    continueRelay: boolean;
  }) => Promise<string>) | null = null;

  get isReady() {
    return this.initialized;
  }

  private webNudgeInjected = false;

  /** Apply the chat-mode tool policy live (no rebuild): native and/or web tools. */
  private applyChatTools() {
    if (!this.chatMode || !this.session) return;
    try {
      // Combine the toggled-on tool sets. Unknown names (e.g. web tools when
      // pi-web-access isn't installed) are skipped by the SDK.
      const tools = [
        ...(this.toolsEnabled ? CHAT_NATIVE_TOOLS : []),
        ...(this.webEnabled ? CHAT_WEB_TOOLS : []),
      ];
      (this.session as any).setActiveToolsByName?.(tools);
    } catch (err) {
      console.error("[pi-desktop] Failed to apply chat tools:", err);
    }
  }

  /** Inject a one-time context note nudging the model to actually search. */
  private injectWebNudge() {
    if (this.webNudgeInjected || !this.session) return;
    try {
      const sm = (this.session as any).sessionManager ?? this.sessionManager;
      sm?.appendCustomMessageEntry?.(
        "web-search-hint",
        "Web search is enabled for this conversation via the web_search tool. When the user asks about specific people, places, organizations, businesses, products, prices, recent/current events, or anything you are not certain of from training, CALL web_search to look it up. Do NOT answer from memory when unsure, and do NOT tell the user to search it themselves — search it for them.",
        false,
      );
      this.webNudgeInjected = true;
    } catch (err) {
      console.error("[pi-desktop] web nudge failed:", err);
    }
  }

  /** Toggle the native Pi tools (read/bash/edit/…) in a chat session live. */
  setToolsEnabled(enabled: boolean) {
    this.toolsEnabled = enabled;
    this.applyChatTools();
    this.emitState();
    return { success: true, toolsEnabled: enabled };
  }

  /** Toggle Pi Routing (MOA pre-processing) for this session. */
  setRoutingEnabled(enabled: boolean, teamId?: string) {
    this.routingEnabled = enabled;
    if (teamId) this.routingTeamId = teamId;
    if (!enabled) this.routingTeamId = null;
    this.emitState();
    return { success: true, routingEnabled: enabled };
  }

  /** Toggle Tag Team (sequential model relay) for this session. */
  setTagTeamEnabled(enabled: boolean, teamId?: string) {
    this.tagTeamEnabled = enabled;
    if (teamId) this.tagTeamTeamId = teamId;
    if (!enabled) this.tagTeamTeamId = null;
    // Toggling from the UI always (re)starts the relay at the starter stage.
    this.tagTeamStageIndex = 0;
    this.emitState();
    return { success: true, tagTeamEnabled: enabled };
  }

  /** Toggle the web-search tools in a chat session without losing context. */
  setWebEnabled(enabled: boolean) {
    this.webEnabled = enabled;
    this.applyChatTools();
    if (enabled) {
      this.injectWebNudge();
      if (this.isWebSearchAvailable()) {
        this.events.emit(
          this.DIAG_EVENT,
          this.isWebAccessInstalled()
            ? "Web search enabled (pi-web-access)."
            : "Web search enabled — using the built-in tool (DuckDuckGo, no key required).",
        );
      } else {
        this.events.emit(this.DIAG_EVENT, "Web search is unavailable in this session.");
      }
    }
    this.emitState();
    return { success: true, webEnabled: enabled, available: this.isWebSearchAvailable() };
  }

  /** Whether the pi-web-access package is configured (then it owns web_search). */
  private isWebAccessInstalled(): boolean {
    try {
      const sm: any = this._deps?.settingsManager;
      const pkgs = [...(sm?.getPackages?.() ?? []), ...(sm?.getProjectPackages?.() ?? [])];
      return pkgs.some((p: any) => String(p).includes("pi-web-access"));
    } catch {
      return false;
    }
  }

  /** Whether a web_search tool is registered (native or pi-web-access). */
  isWebSearchAvailable(): boolean {
    try {
      const names = new Set(((this.session as any)?.getAllTools?.() ?? []).map((t: any) => t.name));
      return CHAT_WEB_TOOLS.some((n) => names.has(n));
    } catch {
      return false;
    }
  }

  get deps() {
    return this._deps;
  }

  /** Throwaway working dir for chat-mode sessions (~/.pi/chat). */
  private resolveChatCwd(pi: typeof import("@earendil-works/pi-coding-agent")): string {
    const dir = join(homedir(), pi.CONFIG_DIR_NAME, "chat");
    try { mkdirSync(dir, { recursive: true }); } catch {}
    return dir;
  }

  async init(cwd?: string, opts?: { chatMode?: boolean }) {
    const pi = await import("@earendil-works/pi-coding-agent");
    this.chatMode = opts?.chatMode ?? false;
    if (cwd) this.cwd = cwd;
    else if (this.chatMode) this.cwd = this.resolveChatCwd(pi);
    else this.cwd = homedir();
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
    // Ensure every custom provider's key is in authStorage from the start, so
    // model selection works without depending on which registry instance is hit.
    this.registerCustomProviderKeys();
    this.initialized = true;
  }

  private createRuntimeFactory(pi: typeof import("@earendil-works/pi-coding-agent")) {
    return async ({ cwd, sessionManager, sessionStartEvent }: any) => {
      // Create FRESH services every time the factory is called.
      // The resourceLoader inside services holds an extension runner that
      // gets invalidated on session replacement (switch/fork/new/clone).
      // Reusing cached services causes "stale extension ctx" errors.
      // PASS settingsManager so skill/extension/package removals take effect.
      const services = await pi.createAgentSessionServices({
        cwd,
        agentDir: this.agentDir,
        authStorage: this._deps?.authStorage,
        settingsManager: this._deps?.settingsManager,
      });
      // Update modelRegistry after services loads custom models from models.json
      if (this._deps && services.modelRegistry) {
        this._deps.modelRegistry = services.modelRegistry;
      }
      // Register our native headless web_search ONLY when the pi-web-access
      // package isn't installed — that package's richer web_search takes priority.
      const customTools = this.isWebAccessInstalled() ? undefined : [createNativeWebSearchTool()];
      const result = await pi.createAgentSessionFromServices({
        services,
        sessionManager,
        sessionStartEvent,
        ...(customTools ? { customTools } : {}),
      });
      // Chat mode restricts tools via setActiveToolsByName in attachSession
      // (NOT noTools:"all" — that policy filters tools back out on every turn's
      // rebuild, so toggled-on web tools would never actually be callable).
      return { ...result, services, diagnostics: services.diagnostics };
    };
  }

  private async buildRuntime(
    pi: typeof import("@earendil-works/pi-coding-agent"),
    cwd: string,
    sessionManager: PiSessionManagerType,
  ) {
    // Tear down any existing runtime/session before replacing it. Without this,
    // every cwd change / setCwd leaks a full runtime: child processes, file
    // watchers, undici sockets, and the SDK session it holds.
    if (this.runtime) {
      try { this.unsubscribe?.(); } catch {}
      this.unsubscribe = null;
      try { this.session?.dispose?.(); } catch {}
      this.session = null;
      const oldRuntime = this.runtime;
      this.runtime = null;
      try { await (oldRuntime as any)?.dispose?.(); } catch {}
      try { await (oldRuntime as any)?.services?.dispose?.(); } catch {}
    }

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
    const previous = this.session;
    if (this.unsubscribe) this.unsubscribe();
    this.session = session;
    this.isCompacting = false; // a fresh/replaced session is never mid-compaction
    this.webNudgeInjected = false; // re-inject the web hint for the new session
    // Drop stale extension UI from the previous session and cancel any open
    // dialog, then clear the renderer's badges/widgets for this tab.
    this.cancelPendingDialogs();
    this.events.emit(this.EXT_UI_EVENT, { kind: "reset" });
    // Light up extension-driven UI (plan-mode banner, subagent status, …) by
    // giving the extension runner our renderer-backed UI adapter. Without this
    // extensions get a no-op UI and their status/widgets/dialogs never appear.
    try {
      (session as any).extensionRunner?.setUIContext?.(this.uiBridge, "rpc");
    } catch (err) {
      console.error("[pi-desktop] Failed to set extension UI context:", err);
    }
    this.unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      this.onAgentEvent(event);
    });
    // Chat sessions start tool-less (noTools:"all"); re-apply the web toggle.
    this.applyChatTools();
    // Dispose the outgoing session the runtime just swapped out (new/fork/
    // switch/clone). Guarded so we never touch the session we just attached.
    if (previous && previous !== session) {
      try { (previous as any).dispose?.(); } catch {}
    }
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
      this.isCompacting = false; // safety reset in case compaction_end was missed
      // Full state emit to update cost/tokens after the turn.
      this.emitState();
    } else if (event.type === "compaction_start") {
      this.isCompacting = true;
      this.emitState();
    } else if (event.type === "compaction_end") {
      this.isCompacting = false;
      this.emitState();
    } else if (event.type === "message_end") {
      this.emitState();
    }
  }

  /** Build and emit a state summary from the current session. */
  async emitState() {
    if (!this.session) return;
    const s = this.session;
    const model = s.model;
    let contextTokens: number | null = null;
    let contextWindow: number | null = null;
    let totalTokens: number | null = null;
    let totalCost: number | null = null;
    let reasoningTokens: number | null = null;
    try {
      const usage = s.getContextUsage?.();
      if (usage) {
        contextTokens = usage.tokens;
        contextWindow = usage.contextWindow ?? model?.contextWindow ?? null;
      }
    } catch {}
    try {
      // Use the manager's own aggregate (which sums reasoning tokens from
      // per-message usage) rather than the SDK's getSessionStats(), so the
      // Pi 0.80.3 reasoning breakdown is surfaced.
      const stats = await this.getSessionStats();
      if (stats) {
        totalTokens = stats.tokens?.total ?? null;
        totalCost = stats.cost ?? null;
        reasoningTokens = stats.tokens?.reasoning ?? null;
      }
    } catch {}
    this.events.emit(this.STATE_EVENT, {
      isStreaming: s.isStreaming,
      isCompacting: this.isCompacting,
      autoCompactionEnabled: (s as any).autoCompactionEnabled ?? true,
      chatMode: this.chatMode,
      webEnabled: this.webEnabled,
      toolsEnabled: this.toolsEnabled,
      routingEnabled: this.routingEnabled,
      routingTeamId: this.routingTeamId,
      tagTeamEnabled: this.tagTeamEnabled,
      tagTeamTeamId: this.tagTeamTeamId,
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
      reasoningTokens,
    });
  }

  // --- Prompting ---------------------------------------------------------

  async prompt(message: string, opts?: { images?: any[]; streamingBehavior?: "steer" | "followUp" }) {
    if (!this.session) throw new Error("Session not initialized");

    // Pi Routing: pre-process the prompt through an MOA team before the main
    // model builds its response. The synthesized briefing is injected as a
    // hidden context message (same pattern as injectWebNudge). If MOA fails
    // entirely, we fall through to a normal prompt — the user isn't blocked.
    if (this.routingEnabled && this.routingTeamId && !opts?.streamingBehavior) {
      try {
        await this.runMoaEnrichment(message);
      } catch (err) {
        console.error("[pi-desktop] MOA enrichment failed, proceeding without:", err);
        this.events.emit(this.DIAG_EVENT, `Pi Routing failed: ${err instanceof Error ? err.message : String(err)}. Proceeding without enrichment.`);
      }
    }

    await this.session.prompt(message, {
      images: opts?.images,
      streamingBehavior: opts?.streamingBehavior,
    } as any);

    // Tag Team: after the starter model (stage 0) finishes its turn, hand off
    // to the next stage's model in a new tab. Only triggers on the initial
    // prompt (not steer/followUp), when Tag Team is enabled with a valid team.
    if (this.tagTeamEnabled && this.tagTeamTeamId && !opts?.streamingBehavior) {
      try {
        await this.runTagTeamHandoff();
      } catch (err) {
        console.error("[pi-desktop] Tag Team handoff failed:", err);
        this.events.emit(this.DIAG_EVENT, `Tag Team handoff failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success: true };
  }

  /**
   * Run the MOA pipeline for the current prompt and inject the synthesized
   * briefing into the session context as a hidden custom message. The main
   * model then sees both the user's prompt and the team's analysis when it
   * builds its response. Uses the same appendCustomMessageEntry pattern as
   * injectWebNudge.
   */
  private async runMoaEnrichment(message: string): Promise<void> {
    if (!this.session || !this.routingTeamId || !this.deps?.modelRegistry) return;

    const { loadMoaConfig, findTeam } = await import("../moa/config");
    const { runMoa } = await import("../moa/engine");
    const config = loadMoaConfig();
    const team = findTeam(config, this.routingTeamId);
    if (!team) {
      throw new Error(`Team not found: ${this.routingTeamId}`);
    }

    const sessionMessages = this.session.messages ?? [];
    const result = await runMoa({
      message,
      team,
      modelRegistry: this.deps.modelRegistry,
      sessionMessages,
      mode: config.defaultMode,
      maxLayers: config.advanced.maxLayers,
      confidenceThreshold: config.advanced.confidenceThreshold,
      onProgress: (event) => {
        this.events.emit(this.EXT_UI_EVENT, {
          type: "moa:progress",
          ...event,
        });
      },
    });

    // Inject the briefing as a hidden context message — the main model sees it
    // in its context window but it's not displayed as a chat message.
    const sm = (this.session as any).sessionManager ?? this.sessionManager;
    sm?.appendCustomMessageEntry?.(
      "moa-briefing",
      `[Pi Routing Briefing — Team: ${result.teamName}, Confidence: ${result.confidence}/10, Layers: ${result.layers}]\n\n${result.briefing}`,
      false,
      {
        team: result.teamName,
        layers: result.layers,
        confidence: result.confidence,
        teamResponses: config.advanced.showTeamResponses ? result.teamResponses : undefined,
      },
    );

    this.events.emit(this.DIAG_EVENT, `Pi Routing complete: ${result.teamName} · ${result.layers} layer(s) · ${result.confidence}/10 confidence`);
  }

  /**
   * Run a MOA test from the settings panel. Returns the full result (briefing
   * + per-member responses) so the user can preview how a team performs.
   *
   * Accepts the team object directly (not just an id) so unsaved drafts can be
   * tested before they're persisted — the editor's Test button runs against the
   * in-memory draft.
   */
  async runMoaTest(message: string, team: any, modeOverride?: "basic" | "advanced"): Promise<any> {
    if (!this.deps?.modelRegistry) throw new Error("Model registry not available");
    const { loadMoaConfig } = await import("../moa/config");
    const { runMoa } = await import("../moa/engine");
    const config = loadMoaConfig();
    return runMoa({
      message,
      team,
      modelRegistry: this.deps.modelRegistry,
      sessionMessages: this.session?.messages ?? [],
      mode: modeOverride ?? config.defaultMode,
      maxLayers: config.advanced.maxLayers,
      confidenceThreshold: config.advanced.confidenceThreshold,
    });
  }

  /**
   * Tag Team handoff: after the model at the current relay stage finishes,
   * create a new tab for the NEXT stage's model, hand it the previous output +
   * the handoff prompt, and auto-prompt. The relay continues stage-by-stage —
   * each new tab is itself Tag Team-enabled and points at the following stage —
   * until the final stage, which has no successor and ends the chain.
   */
  private async runTagTeamHandoff(): Promise<void> {
    if (!this.session || !this.tagTeamTeamId || !this.deps?.modelRegistry) return;
    if (!this.tagTeamHandoffCallback) {
      this.events.emit(this.DIAG_EVENT, "Tag Team: tab creation not available. Skipping handoff.");
      return;
    }

    const { loadTagTeamConfig, findTagTeam } = await import("../tagteam/config");
    const config = loadTagTeamConfig();
    const team = findTagTeam(config, this.tagTeamTeamId);
    if (!team || team.stages.length < 2) return;

    // Hand off from the current stage to the next. If we're already at the last
    // stage, the relay is complete — nothing to do.
    const fromStage = this.tagTeamStageIndex;
    const toStage = fromStage + 1;
    if (toStage >= team.stages.length) return;

    const currentStage = team.stages[fromStage];
    const nextStage = team.stages[toStage];

    // Extract this model's output — the last assistant message.
    const messages = this.session.messages ?? [];
    const lastAssistant = [...messages].reverse().find(
      (m: any) => m?.role === "assistant" || m?.type === "assistant",
    );
    const previousOutput = extractMessageText(lastAssistant);
    if (!previousOutput) return;

    const fromModelName = this.deps.modelRegistry.find(currentStage.provider, currentStage.modelId)?.name ?? currentStage.modelId;
    const toModelName = this.deps.modelRegistry.find(nextStage.provider, nextStage.modelId)?.name ?? nextStage.modelId;
    const handoffPrompt = nextStage.handoffPrompt || "Review and improve the work above.";
    // Is there a stage AFTER the one we're handing to? If so, the new tab must
    // keep relaying; if not, it's the finalizer and the chain ends there.
    const continueRelay = toStage + 1 < team.stages.length;

    // Create the tab for the next stage. The callback (set by SessionPool)
    // handles session creation, model switching, context seeding, auto-prompt,
    // relay continuation, and emitting the handoff event with the real tab ids.
    await this.tagTeamHandoffCallback({
      cwd: this.cwd,
      teamId: this.tagTeamTeamId,
      provider: nextStage.provider,
      modelId: nextStage.modelId,
      previousOutput,
      handoffPrompt,
      fromModelName,
      toModelName,
      teamName: team.name,
      fromStage,
      toStage,
      continueRelay,
    });

    this.events.emit(this.DIAG_EVENT, `🏷 Tag Team: ${fromModelName} tagged ${toModelName} → new tab`);
  }

  /**
   * Run a Tag Team test from the settings panel. Runs the message through
   * stage 0 via completeSimple, then hands the output to stage 1. Returns both
   * outputs so the user can preview the relay without creating tabs.
   */
  async runTagTeamTest(message: string, team: any): Promise<any> {
    if (!this.deps?.modelRegistry) throw new Error("Model registry not available");
    const { runTagTeamRelay } = await import("../tagteam/orchestrator");
    return runTagTeamRelay({
      message,
      team,
      modelRegistry: this.deps.modelRegistry,
      sessionMessages: this.session?.messages ?? [],
    });
  }

  async steer(message: string, _images?: any[]) {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.steer(message);
    return { success: true };
  }

  async followUp(message: string, _images?: any[]) {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.followUp(message);
    return { success: true };
  }

  async abort() {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.abort();
    return { success: true };
  }

  /**
   * Remove a single queued (steering/follow-up) message WITHOUT stopping the
   * agent. The SDK has no per-item dequeue, so we clear the queue and re-enqueue
   * everything except the removed item, preserving order.
   */
  async removeQueuedItem(kind: "steering" | "followUp", index: number) {
    if (!this.session) return { success: false };
    const cleared = (this.session as any).clearQueue?.() as
      | { steering: string[]; followUp: string[] }
      | undefined;
    if (!cleared) return { success: false };
    const steering = [...(cleared.steering ?? [])];
    const followUp = [...(cleared.followUp ?? [])];
    if (kind === "steering") steering.splice(index, 1);
    else followUp.splice(index, 1);
    for (const m of steering) await this.session.steer(m);
    for (const m of followUp) await this.session.followUp(m);
    return { success: true };
  }

  // --- Session replacement (re-attaches) ---------------------------------

  async newSession(parentSession?: string, cwd?: string) {
    if (!this.runtime) throw new Error("Runtime not initialized");
    // If a different cwd is requested, rebuild the runtime for that directory.
    if (cwd && cwd !== this.cwd) {
      await this.rebuildForCwd(cwd);
    }
    // SDK expects an options object, not a positional arg.
    await this.runtime.newSession({ parentSession } as any);
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
    try {
      const res: any = await this.runtime.fork("", { position: "at" } as any);
      this.attachSession(this.runtime.session);
      return { success: true, cancelled: res?.cancelled };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  /**
   * Promote a chat-mode session into a real code session bound to `cwd`:
   * archive the conversation to <cwd>/docs/chat-<ts>.md, rebuild the runtime in
   * that folder WITH tools, and seed the new session with the prior chat so the
   * agent keeps context.
   */
  async convertToCode(cwd: string): Promise<{ success: boolean; mdPath?: string; cwd?: string; error?: string }> {
    if (!this.runtime) throw new Error("Runtime not initialized");

    // Capture the conversation BEFORE any rebuild replaces the session.
    const prior = this.getMessages();

    // 1. Archive the transcript. If this fails, keep the chat intact (don't convert).
    let mdPath: string;
    try {
      const docsDir = join(cwd, "docs");
      await mkdir(docsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      mdPath = join(docsDir, `chat-${ts}.md`);
      await writeFile(mdPath, serializeTranscript(prior, cwd, ts), "utf-8");
    } catch (err: any) {
      return { success: false, error: `Could not write transcript: ${err?.message ?? String(err)}` };
    }

    // 2. Rebuild bound to the folder with tools (chatMode off → factory omits noTools).
    this.chatMode = false;
    await this.rebuildForCwd(cwd);

    // 3. Seed the fresh code session with the prior conversation as context.
    if (prior.length > 0) {
      try {
        await (this.runtime as any).newSession({
          setup: async (sm: any) => {
            sm.appendMessage({
              role: "user",
              content: buildSeedContextMessage(prior, mdPath),
              timestamp: Date.now(),
            });
          },
        });
        this.attachSession(this.runtime.session);
      } catch (err) {
        // Seeding is best-effort; the converted (empty) code session still works.
        console.error("[pi-desktop] convertToCode seed failed:", err);
      }
    }

    return { success: true, mdPath, cwd };
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
    // Hide throwaway chat-mode sessions (they live in the scratch dir).
    const chatDir = join(homedir(), pi.CONFIG_DIR_NAME, "chat");
    // Map to include cwd for the renderer.
    return sessions
      .filter((s: any) => s.cwd !== chatDir)
      .map((s: any) => ({
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
      isCompacting: this.isCompacting,
      autoCompactionEnabled: (s as any).autoCompactionEnabled ?? true,
      chatMode: this.chatMode,
      webEnabled: this.webEnabled,
      toolsEnabled: this.toolsEnabled,
      routingEnabled: this.routingEnabled,
      routingTeamId: this.routingTeamId,
      tagTeamEnabled: this.tagTeamEnabled,
      tagTeamTeamId: this.tagTeamTeamId,
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
    // Reasoning/thinking tokens reported by some providers (Pi 0.80.3+). These
    // are a SUBSET of `output` (the SDK doc is explicit), so they're surfaced
    // as a breakdown detail and deliberately NOT added to `total`.
    let reasoning = 0;
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
          reasoning += usage.reasoning ?? 0;
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
      tokens: {
        input,
        output,
        cacheRead,
        cacheWrite,
        // `reasoning` is a subset of `output` — do not add it here.
        total: input + output + cacheRead + cacheWrite,
        reasoning,
      },
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
    await this.session.cycleModel();
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

  /**
   * Rebuild the model registry from models.json so newly added/edited/removed
   * custom models appear immediately — without opening a new tab or restarting.
   * Mirrors init(): pulls a fresh registry from the (just-invalidated) shared
   * deps cache. Call invalidateSharedDeps() before this so the cache rebuilds.
   */
  /**
   * Mirror every custom provider's literal key into the SDK's authStorage. The
   * live session's model registry validates selection and resolves request keys
   * against this same authStorage, so registering here makes a model that was
   * added OR edited mid-session take effect immediately — no restart, and no
   * need to re-save every model.
   */
  private registerCustomProviderKeys(): void {
    if (!this._deps) return;
    for (const cred of listCustomProviderCredentials()) {
      try {
        this._deps.authStorage.set(cred.provider, { type: "api_key", key: cred.apiKey });
      } catch {
        /* best-effort: a failed registration just means restart-to-apply */
      }
    }
  }

  async refreshModelRegistry(): Promise<void> {
    if (!this._deps || !this.agentDir) return;
    const pi = await import("@earendil-works/pi-coding-agent");
    // Keep the SAME authStorage the live session was built with, and sync all
    // custom keys into it, so selection/edits apply to the running session.
    this.registerCustomProviderKeys();
    // Fresh listing registry (sharing that authStorage) so add/edit/remove show
    // up in the model list immediately.
    this._deps.modelRegistry = pi.ModelRegistry.create(
      this._deps.authStorage,
      join(this.agentDir, "models.json"),
    );
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
    try {
      const res: any = await this.session.compact(customInstructions);
      return {
        success: true,
        summary: res?.summary,
        tokensBefore: res?.tokensBefore,
        estimatedTokensAfter: res?.estimatedTokensAfter,
      };
    } catch (err: any) {
      // e.g. "Nothing to compact (session too short)" — return gracefully so the
      // IPC layer doesn't surface a scary "Error in pi:compact".
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  abortCompaction() {
    if (!this.session) throw new Error("Session not initialized");
    this.session.abortCompaction();
    return { success: true };
  }

  /** Enable/disable per-session auto-compaction (keeps context from overflowing). */
  setAutoCompaction(enabled: boolean) {
    if (!this.session) throw new Error("Session not initialized");
    try {
      (this.session as any).setAutoCompactionEnabled?.(enabled);
    } catch (err) {
      console.error("[pi-desktop] setAutoCompaction failed:", err);
    }
    this.emitState();
    return { success: true, autoCompactionEnabled: enabled };
  }

  // --- Package management (SDK-based, no pi CLI needed) ------------------

  private async getPackageManager(): Promise<any> {
    if (!this._deps?.settingsManager) throw new Error("Settings manager not initialized");
    const pi = await import("@earendil-works/pi-coding-agent");
    return new pi.DefaultPackageManager({
      cwd: this.cwd,
      agentDir: this.agentDir,
      settingsManager: this._deps.settingsManager,
    });
  }

  async installPackage(spec: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pm = await this.getPackageManager();
      await pm.installAndPersist(spec);
      return { success: true };
    } catch (err: any) {
      console.error("[pi-desktop] Package install failed:", err);
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  async removePackage(spec: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pm = await this.getPackageManager();
      await pm.removeAndPersist(spec);
      return { success: true };
    } catch (err: any) {
      console.error("[pi-desktop] Package remove failed:", err);
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  async listPackages(): Promise<{ spec: string; name: string; source: string }[]> {
    try {
      const pm = await this.getPackageManager();
      const configured = pm.listConfiguredPackages();
      return configured.map((p: any) => ({
        spec: p.source,
        name: p.source.replace(/^npm:/, "").split("@")[0] || p.source,
        source: p.source.startsWith("npm:") ? "npm" : p.source.startsWith("git") || p.source.startsWith("http") ? "git" : "local",
      }));
    } catch (err: any) {
      console.error("[pi-desktop] Package list failed:", err);
      return [];
    }
  }

  /**
   * Update a single configured package to its latest version. Mirrors `pi update`.
   * Lets users upgrade extensions from the UI instead of dropping to a terminal.
   */
  async updatePackage(
    spec: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pm = await this.getPackageManager();
      await pm.update(spec);
      return { success: true };
    } catch (err: any) {
      console.error("[pi-desktop] Package update failed:", err);
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  /**
   * Check which configured packages have a newer version available, without
   * installing. Powers the "Update available" badges in the Extensions view.
   */
  async checkForPackageUpdates(): Promise<
    { source: string; displayName: string; type: "npm" | "git" }[]
  > {
    try {
      const pm = await this.getPackageManager();
      const updates = await pm.checkForAvailableUpdates();
      return (updates ?? []).map((u: any) => ({
        source: u.source,
        displayName: u.displayName,
        type: u.type,
      }));
    } catch (err: any) {
      console.error("[pi-desktop] Package update check failed:", err);
      return [];
    }
  }

  /** Remove a skill by its path from the settings. */
  async removeSkill(skillPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this._deps?.settingsManager) throw new Error("Settings manager not initialized");
      const sm = this._deps.settingsManager;
      const skills = sm.getSkillPaths();
      const filtered = skills.filter((p: string) => p !== skillPath && !p.endsWith(skillPath));
      if (filtered.length < skills.length) {
        sm.setSkillPaths(filtered);
        await this.reloadResources();
        return { success: true };
      }
      return { success: false, error: "Skill path not found in settings" };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  /** Remove an extension by its path from the settings. */
  async removeExtension(extPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this._deps?.settingsManager) throw new Error("Settings manager not initialized");
      const sm = this._deps.settingsManager;
      const extensions = sm.getExtensionPaths();
      const filtered = extensions.filter((p: string) => p !== extPath && !p.endsWith(extPath));
      if (filtered.length < extensions.length) {
        sm.setExtensionPaths(filtered);
        await this.reloadResources();
        return { success: true };
      }
      return { success: false, error: "Extension path not found in settings" };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  /** Restore to stock Pi: remove all packages, extensions, skills, prompts, and themes. */
  async restoreToStock(): Promise<{ success: boolean; removed: string[]; error?: string }> {
    try {
      if (!this._deps?.settingsManager) throw new Error("Settings manager not initialized");
      const sm = this._deps.settingsManager;
      const removed: string[] = [];

      // Remove all packages
      const pm = await this.getPackageManager();
      const packages = pm.listConfiguredPackages();
      for (const pkg of packages) {
        try {
          await pm.removeAndPersist(pkg.source);
          removed.push(`package: ${pkg.source}`);
        } catch {}
      }

      // Clear extension paths
      const extensions = sm.getExtensionPaths();
      if (extensions.length > 0) {
        sm.setExtensionPaths([]);
        removed.push(`extensions: ${extensions.length} removed`);
      }

      // Clear skill paths
      const skills = sm.getSkillPaths();
      if (skills.length > 0) {
        sm.setSkillPaths([]);
        removed.push(`skills: ${skills.length} removed`);
      }

      // Clear prompt paths
      const prompts = sm.getPromptTemplatePaths();
      if (prompts.length > 0) {
        sm.setPromptTemplatePaths([]);
        removed.push(`prompts: ${prompts.length} removed`);
      }

      // Clear theme paths
      const themes = sm.getThemePaths();
      if (themes.length > 0) {
        sm.setThemePaths([]);
        removed.push(`themes: ${themes.length} removed`);
      }

      // Clear packages from settings
      sm.setPackages([]);
      sm.setProjectPackages([]);

      return { success: true, removed };
    } catch (err: any) {
      return { success: false, removed: [], error: err?.message ?? String(err) };
    }
  }

  // --- Misc --------------------------------------------------------------

  async getAuthStatus() {
    if (!this._deps?.authStorage) return [];
    const authStorage = this._deps.authStorage;
    // Build the provider set from (a) the SDK's registered OAuth providers —
    // Anthropic (Claude Pro/Max), OpenAI (ChatGPT), GitHub Copilot — plus
    // (b) the legacy API-key-only providers so both surfaces show in Settings.
    const oauthProviders: { id: string; name: string }[] = [];
    try {
      for (const p of authStorage.getOAuthProviders() ?? []) {
        oauthProviders.push({ id: p.id, name: p.name });
      }
    } catch {
      /* getOAuthProviders not available — fall back to API-key providers only */
    }
    const apiKeyProviders = ["openai", "google", "anthropic"];
    // Merge, dedupe by id (OAuth "anthropic" overlaps the API-key one).
    const seen = new Set<string>();
    const providers: { id: string; name: string; oauth: boolean }[] = [];
    for (const p of oauthProviders) {
      if (!seen.has(p.id)) { seen.add(p.id); providers.push({ ...p, oauth: true }); }
    }
    for (const id of apiKeyProviders) {
      if (!seen.has(id)) { seen.add(id); providers.push({ id, name: id, oauth: false }); }
    }

    const status: any[] = [];
    for (const { id, name, oauth } of providers) {
      const statusInfo = authStorage.getAuthStatus(id);
      const credential = authStorage.get(id);
      const isOauth = credential?.type === "oauth";
      status.push({
        provider: id,
        name,
        authed: statusInfo.configured,
        // Whether the provider offers subscription (OAuth) login at all.
        loginType: oauth ? "oauth" : "apiKey",
        // How it's currently authenticated — oauth subscription vs api_key.
        type: isOauth ? "oauth" : "apiKey",
      });
    }
    return status;
  }

  async setApiKey(provider: string, apiKey: string) {
    if (!this._deps?.authStorage) return { success: false, error: "Auth not initialized" };
    this._deps.authStorage.set(provider, { type: "api_key", key: apiKey });
    return { success: true };
  }

  async logout(provider: string) {
    if (!this._deps?.authStorage) return { success: false, error: "Auth not initialized" };
    this._deps.authStorage.remove(provider);
    return { success: true };
  }

  /**
   * Run an OAuth subscription login (Claude Pro/Max, ChatGPT, Copilot) using the
   * SDK's AuthStorage.login(). All PKCE / device-code / token-exchange work
   * happens inside the SDK; we only bridge the interactive callbacks to the
   * renderer over the AUTH_EVENT channel so the user sees a login modal.
   */
  async login(providerId: string): Promise<{ success: boolean; error?: string }> {
    if (!this._deps?.authStorage) return { success: false, error: "Auth not initialized" };
    const authStorage = this._deps.authStorage;
    try {
      await authStorage.login(providerId, {
        // Browser PKCE flow (Anthropic, Codex browser method): open the authorize
        // URL in the system browser AND tell the renderer to show a "complete
        // sign-in" panel with a manual-code-paste fallback.
        onAuth: (info: { url: string; instructions?: string }) => {
          shell.openExternal(info.url).catch(() => {});
          this.events.emit(this.AUTH_EVENT, {
            kind: "auth",
            provider: providerId,
            url: info.url,
            instructions: info.instructions,
          });
        },
        // Device-code flow (Copilot, Codex device method): show the user code and
        // open the verification page. The renderer displays the code prominently.
        onDeviceCode: (info: { userCode: string; verificationUri: string }) => {
          if (info.verificationUri) shell.openExternal(info.verificationUri).catch(() => {});
          this.events.emit(this.AUTH_EVENT, {
            kind: "deviceCode",
            provider: providerId,
            userCode: info.userCode,
            verificationUri: info.verificationUri,
          });
        },
        onProgress: (message: string) => {
          this.events.emit(this.AUTH_EVENT, { kind: "progress", provider: providerId, message });
        },
        // Blocking: ask the renderer for a text input (e.g. manual auth code).
        onPrompt: (prompt: { message: string; placeholder?: string; allowEmpty?: boolean }) =>
          this.requestAuthInput(providerId, "prompt", {
            message: prompt.message,
            placeholder: prompt.placeholder,
            allowEmpty: prompt.allowEmpty,
          }),
        // Blocking: ask the renderer to pick an option (e.g. Codex browser vs device).
        onSelect: (prompt: { message: string; options: { id: string; label: string }[] }) =>
          this.requestAuthInput(providerId, "select", {
            message: prompt.message,
            options: prompt.options,
          }),
        // Blocking: manual code paste fallback for callback-server flows.
        onManualCodeInput: () =>
          this.requestAuthInput(providerId, "manualCode", {
            message: "Paste the authorization code from the browser:",
            placeholder: "code",
          }),
      });
      // Credentials persisted by the SDK to auth.json. Rebuild deps so model
      // registries pick up the new OAuth token.
      invalidateSharedDeps();
      // Rebuild THIS session's listing registry before announcing "done" so the
      // provider's (possibly newly-released) models are pulled and the model
      // list is already fresh when the renderer refreshes on the done event.
      try {
        await this.refreshModelRegistry();
      } catch (err) {
        console.error("[pi-desktop] Failed to refresh model registry after login:", err);
      }
      this.events.emit(this.AUTH_EVENT, { kind: "done", provider: providerId });
      return { success: true };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.events.emit(this.AUTH_EVENT, { kind: "error", provider: providerId, message });
      return { success: false, error: message };
    }
  }

  /**
   * Push a blocking OAuth prompt to the renderer and await its reply. Mirrors
   * the pendingDialogs/registerDialog pattern for extension dialogs.
   */
  private requestAuthInput(
    provider: string,
    kind: "prompt" | "select" | "manualCode",
    payload: { message: string; placeholder?: string; allowEmpty?: boolean; options?: { id: string; label: string }[] },
  ): Promise<string> {
    return new Promise((resolve) => {
      const requestId = `auth-${++this.authPromptSeq}`;
      this.pendingAuthPrompts.set(requestId, (value) => resolve(value ?? ""));
      this.events.emit(this.AUTH_EVENT, { kind, provider, requestId, ...payload });
    });
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

  /** Reload resources so skill/extension/package changes are reflected immediately. */
  async reloadResources() {
    const loader = this.getResourceLoader();
    if (loader?.reload) {
      try {
        await loader.reload();
      } catch (err) {
        console.error("[pi-desktop] Failed to reload resources:", err);
      }
    }
  }

  async getExtensions() {
    const loader = this.getResourceLoader();
    if (!loader) return [];
    const result = loader.getExtensions();
    const items: { path: string; error?: string; source?: string }[] = [];
    for (const ext of result.extensions) {
      items.push({
        path: (ext as any).path ?? (ext as any).name ?? "extension",
        source: (ext as any).sourceInfo?.location ?? (ext as any).source ?? "",
      });
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
    return {
      skills: skills.map((s: any) => ({
        name: s.name,
        description: s.description,
        source: s.sourceInfo?.location ?? s.source,
        path: s.baseDir ?? s.filePath ?? "",
      })),
    };
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

  dispose() {
    this.cancelPendingDialogs();
    try { this.unsubscribe?.(); } catch {}
    this.unsubscribe = null;
    try { this.session?.dispose?.(); } catch {}
    // Release the runtime too (child processes, file watchers, sockets).
    try { (this.runtime as any)?.dispose?.(); } catch {}
    try { (this.runtime as any)?.services?.dispose?.(); } catch {}
    this.session = null;
    this.runtime = null;
    this.isCompacting = false;
    this.initialized = false;
    this.events.removeAllListeners();
  }
}

/**
 * Extract text content from a Pi agent message. Handles both string content
 * and content-block arrays (text/tool_use/etc.), mirroring the SDK's shape.
 */
function extractMessageText(message: any): string {
  if (!message) return "";
  const content = message.content ?? message.text ?? message.message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c?.type === "text" || typeof c === "string")
      .map((c: any) => (typeof c === "string" ? c : c.text ?? ""))
      .join("");
  }
  return "";
}
