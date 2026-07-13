import { create } from "zustand";
import type { PanelContribution, StatusItemContribution, ToolRendererContribution, PackageUpdateInfo } from "../../../shared/ipc";

export interface ContentBlock {
  type: "text" | "thinking" | "toolCall" | "toolResult";
  text?: string;
  toolName?: string;
  toolCallId?: string;
  arguments?: any;
  result?: any;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "toolResult" | "system";
  blocks: ContentBlock[];
  streaming?: boolean;
  timestamp: number;
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args: any;
  partialResult?: any;
  result?: any;
  isError?: boolean;
  done: boolean;
}

export interface PiState {
  isStreaming?: boolean;
  /** Chat-mode 🔍 web-search toggle (chat tabs only). */
  webEnabled?: boolean;
  /** Chat-mode native-tools toggle (read/bash/edit/…). */
  toolsEnabled?: boolean;
  /** Pi Routing: MOA pre-processing enabled for this session. */
  routingEnabled?: boolean;
  /** The MOA team id selected for routing. */
  routingTeamId?: string | null;
  /** Tag Team: sequential model relay enabled for this session. */
  tagTeamEnabled?: boolean;
  /** The Tag Team id selected for the relay. */
  tagTeamTeamId?: string | null;
  /** Per-session auto-compaction toggle. */
  autoCompactionEnabled?: boolean;
  modelId?: string;
  modelName?: string;
  provider?: string;
  thinkingLevel?: string;
  sessionId?: string;
  sessionName?: string;
  sessionFile?: string;
  cwd?: string;
  messageCount?: number;
  contextTokens?: number | null;
  contextWindow?: number | null;
  totalTokens?: number | null;
  totalCost?: number | null;
  /** Cumulative reasoning/thinking tokens (Pi 0.80.3+). Subset of output. */
  reasoningTokens?: number | null;
}

export interface QueueState {
  steering: string[];
  followUp: string[];
}

export type View = "chat" | "model" | "settings" | "extensions" | "packages" | "tagteam" | "moa" | "panel";

export interface ExtWidget {
  lines: string[];
  placement: string;
}

export interface ExtDialogRequest {
  id: string;
  tabId?: string;
  method: "select" | "confirm" | "input" | "editor";
  title: string;
  message?: string;
  placeholder?: string;
  prefill?: string;
  options?: string[];
}

/**
 * State of an in-flight OAuth subscription login, driven by AuthEvent messages
 * pushed from the main process. `null` when no login is active.
 */
export interface AuthFlow {
  provider: string;
  phase: "browser" | "deviceCode" | "progress" | "prompt" | "select" | "manualCode" | "done" | "error";
  /** Present only for blocking phases (prompt/select/manualCode). */
  requestId?: string;
  message?: string;
  url?: string;
  userCode?: string;
  verificationUri?: string;
  placeholder?: string;
  options?: { id: string; label: string }[];
  error?: string;
}

export interface ExtToast {
  id: number;
  message: string;
  level: "info" | "warning" | "error";
}

export type TabMode = "chat" | "code";

/**
 * MOA (Pi Routing) activity state for a tab — drives the StatusBar indicator,
 * TabBar icon, and post-completion report card. UI-only; not emitted by the
 * backend (the backend emits `moa:progress` / `moa:result` ext-ui events that
 * the renderer maps into this state).
 */
export interface MoaActivity {
  /** Current phase: "fanning-out", "member-done", "aggregating", etc. */
  phase: string;
  /** Human-readable message, e.g. "2/3 models responded". */
  message?: string;
  /** How many team members have finished responding. */
  membersDone?: number;
  /** Total team members. */
  membersTotal?: number;
  /** Which member just completed (model name). */
  member?: string;
  /** Set when MOA completes — carries the full result for the report card. */
  result?: {
    teamName: string;
    briefing: string;
    teamResponses: { modelName: string; role?: string; response?: string; error?: string; score?: number }[];
    layers: number;
    confidence: number | null;
  };
}

export interface TabState {
  id: string;
  title: string;
  cwd?: string;
  /** "chat" = quick conversation, no folder/tools; "code" = folder-bound session. */
  mode: TabMode;
  messages: ChatMessage[];
  tools: Record<string, ToolExecution>;
  piState: PiState;
  queue: QueueState;
  /** Extension-driven status badges, keyed by the extension's status key. */
  extStatuses: Record<string, string>;
  /** Extension-driven widgets (banners), keyed by widget key. */
  extWidgets: Record<string, ExtWidget>;
  /** MOA (Pi Routing) activity — null when MOA is not running on this tab. */
  moaActivity?: MoaActivity | null;
}

export interface Tab {
  id: string;
  title: string;
  cwd?: string;
  mode?: TabMode;
}

export interface Favorite {
  path: string;
  name: string;
}

interface AppState {
  // Tab state
  tabs: Tab[];
  activeTabId: string | null;
  tabStates: Record<string, TabState>;

  // Favorites (persisted to localStorage)
  favorites: Favorite[];

  // UI state
  activeView: View;
  sidebarOpen: boolean;
  sessionsPanelOpen: boolean;
  diagnostics: string[];

  // Extension UI (driven by Pi extensions via the UI bridge)
  extDialog: ExtDialogRequest | null;
  toasts: ExtToast[];

  // OAuth subscription login flow (Claude Pro/Max, ChatGPT, Copilot)
  authFlow: AuthFlow | null;

  // Addon contributions (Tier 2: declarative panels + status items)
  panels: PanelContribution[];
  statusItems: StatusItemContribution[];
  activePanelId: string | null;
  /** Custom tool-call result renderers (Tier 2b), keyed by tool name. */
  toolRenderers: Record<string, ToolRendererContribution>;

  // Default mode for new tabs (Chat/Code toggle), persisted to localStorage.
  defaultTabMode: TabMode;

  // Resolved Pi SDK version (refreshed from the SDK's own VERSION export on
  // mount so the displayed version never drifts after a bump).
  sdkVersion: string;

  // Configured packages that have a newer version available (drives the
  // orange dot on the Extensions nav item + the Update buttons in the view).
  packageUpdates: PackageUpdateInfo[];

  // Derived (from active tab)
  activeTab: TabState;

  // Tab actions
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  setDefaultTabMode: (mode: TabMode) => void;
  /**
   * If a tab is already open for `cwd`, focus it (and return true) instead of
   * letting the caller open a duplicate. Returns false when no such tab exists,
   * so the caller should proceed to create a new one. One tab per folder.
   */
  focusExistingTab: (cwd?: string) => boolean;

  // Per-tab state actions
  setTabPiState: (tabId: string, s: Partial<PiState>) => void;
  setTabQueue: (tabId: string, q: QueueState) => void;
  /** Update MOA (Pi Routing) activity for a tab — drives StatusBar + report card.
   *  Accepts either a value or an updater function (receives the current activity). */
  setTabMoaActivity: (tabId: string, activity: MoaActivity | null | ((prev: MoaActivity | null) => MoaActivity | null)) => void;
  resetTabMessages: (tabId: string) => void;
  loadTabMessages: (tabId: string, rawMessages: any[]) => void;
  handleTabAgentEvent: (tabId: string, event: any) => void;

  // UI actions
  setActiveView: (v: View) => void;
  setSidebarOpen: (o: boolean) => void;
  setSessionsPanelOpen: (o: boolean) => void;
  setSdkVersion: (v: string) => void;
  setPackageUpdates: (updates: PackageUpdateInfo[]) => void;
  /** Re-check configured packages for available updates; refreshes the store. */
  refreshPackageUpdates: () => Promise<void>;
  addDiagnostic: (msg: string) => void;

  // Extension UI actions
  handleExtUi: (tabId: string, message: any) => void;
  clearExtDialog: () => void;
  dismissToast: (id: number) => void;

  // OAuth login actions
  handleAuthEvent: (message: any) => void;
  clearAuthFlow: () => void;

  // Addon actions
  loadAddons: () => void;
  openPanel: (id: string) => void;

  // Favorites actions
  addFavorite: (path: string) => void;
  removeFavorite: (path: string) => void;
  loadFavorites: () => void;
}

function emptyTabState(id: string, title: string, cwd?: string, mode: TabMode = "code"): TabState {
  return {
    id,
    title,
    cwd,
    mode,
    messages: [],
    tools: {},
    piState: { cwd },
    queue: { steering: [], followUp: [] },
    extStatuses: {},
    extWidgets: {},
  };
}

let toastSeq = 0;

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  tabStates: {},
  favorites: [],
  activeView: "chat",
  sidebarOpen: true,
  sessionsPanelOpen: false,
  diagnostics: [],
  extDialog: null,
  toasts: [],
  authFlow: null,
  panels: [],
  statusItems: [],
  activePanelId: null,
  toolRenderers: {},
  sdkVersion: "",
  packageUpdates: [],
  defaultTabMode: (() => {
    try {
      return (localStorage.getItem("pi-default-tab-mode") as TabMode) || "chat";
    } catch {
      return "chat";
    }
  })(),
  activeTab: emptyTabState("", ""),

  addTab: (tab) =>
    set((st) => ({
      tabs: [...st.tabs, tab],
      tabStates: {
        ...st.tabStates,
        [tab.id]: emptyTabState(tab.id, tab.title, tab.cwd, tab.mode ?? "code"),
      },
      activeTabId: tab.id,
      activeView: "chat",
    })),

  removeTab: (id) =>
    set((st) => {
      const tabs = st.tabs.filter((t) => t.id !== id);
      const tabStates = { ...st.tabStates };
      delete tabStates[id];
      let activeTabId = st.activeTabId;
      if (activeTabId === id) {
        activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      return {
        tabs,
        tabStates,
        activeTabId,
        activeTab: activeTabId ? tabStates[activeTabId] : emptyTabState("", ""),
      };
    }),

  setActiveTab: (id) =>
    set((st) => ({
      activeTabId: id,
      activeTab: st.tabStates[id] ?? emptyTabState("", ""),
    })),

  focusExistingTab: (cwd) => {
    if (!cwd) return false;
    const st = get();
    const existing = st.tabs.find((t) => t.cwd === cwd);
    if (!existing) return false;
    set({
      activeTabId: existing.id,
      activeTab: st.tabStates[existing.id] ?? emptyTabState("", ""),
      activeView: "chat",
    });
    return true;
  },

  updateTab: (id, patch) =>
    set((st) => {
      const updatedState = st.tabStates[id]
        ? {
            ...st.tabStates[id],
            title: patch.title ?? st.tabStates[id].title,
            cwd: patch.cwd ?? st.tabStates[id].cwd,
            mode: patch.mode ?? st.tabStates[id].mode,
          }
        : st.tabStates[id];
      return {
        tabs: st.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        tabStates: { ...st.tabStates, [id]: updatedState },
        activeTab: st.activeTabId === id && updatedState ? updatedState : st.activeTab,
      };
    }),

  setDefaultTabMode: (mode) =>
    set(() => {
      try { localStorage.setItem("pi-default-tab-mode", mode); } catch {}
      return { defaultTabMode: mode };
    }),

  setTabPiState: (tabId, s) => {
    // State events from the backend can carry isStreaming. We must NOT allow
    // a stale state push to flip isStreaming back to true (agent_end is the
    // authority for that). But we DO allow false through, so the backend can
    // reset streaming when a turn ends — a critical fallback if agent_end is
    // missed or delayed.
    const incoming = s as any;
    const allowStreamingReset = incoming.isStreaming === false;
    const { isStreaming: _ignored, ...rest } = incoming;
    if (allowStreamingReset) rest.isStreaming = false;
    set((st) => {
      const ts = st.tabStates[tabId];
      if (!ts) return {};
      const updated = { ...ts, piState: { ...ts.piState, ...rest } };
      return {
        tabStates: { ...st.tabStates, [tabId]: updated },
        activeTab: st.activeTabId === tabId ? updated : st.activeTab,
      };
    });
  },

  setTabQueue: (tabId, q) =>
    set((st) => {
      const ts = st.tabStates[tabId];
      if (!ts) return {};
      const updated = { ...ts, queue: q };
      return {
        tabStates: { ...st.tabStates, [tabId]: updated },
        activeTab: st.activeTabId === tabId ? updated : st.activeTab,
      };
    }),

  setTabMoaActivity: (tabId, activity) =>
    set((st) => {
      const ts = st.tabStates[tabId];
      if (!ts) return {};
      const resolved = typeof activity === "function" ? activity(ts.moaActivity ?? null) : activity;
      const updated = { ...ts, moaActivity: resolved };
      return {
        tabStates: { ...st.tabStates, [tabId]: updated },
        activeTab: st.activeTabId === tabId ? updated : st.activeTab,
      };
    }),

  resetTabMessages: (tabId) =>
    set((st) => {
      const ts = st.tabStates[tabId];
      if (!ts) return {};
      const updated = { ...ts, messages: [], tools: {} };
      return {
        tabStates: { ...st.tabStates, [tabId]: updated },
        activeTab: st.activeTabId === tabId ? updated : st.activeTab,
      };
    }),

  loadTabMessages: (tabId, rawMessages) =>
    set((st) => {
      const ts = st.tabStates[tabId];
      if (!ts) return {};
      const messages: ChatMessage[] = [];
      const tools: Record<string, ToolExecution> = {};
      for (const raw of rawMessages) {
        const blocks = extractBlocks(raw);
        const role = raw.role === "assistant" ? "assistant"
          : raw.role === "user" ? "user"
          : raw.role === "toolResult" ? "toolResult"
          : "system";
        if (role === "toolResult" && raw.toolCallId) {
          tools[raw.toolCallId] = {
            toolCallId: raw.toolCallId,
            toolName: raw.toolName ?? "tool",
            args: {},
            result: raw.content,
            isError: raw.isError,
            done: true,
          };
        }
        messages.push({
          id: raw.id ?? `${Date.now()}-${Math.random()}`,
          role: role as ChatMessage["role"],
          blocks,
          timestamp: raw.timestamp ?? Date.now(),
        });
        if (role === "assistant") {
          for (const block of blocks) {
            if (block.type === "toolCall" && block.toolCallId) {
              tools[block.toolCallId] = {
                toolCallId: block.toolCallId,
                toolName: block.toolName ?? "tool",
                args: block.arguments ?? {},
                done: true,
                result: tools[block.toolCallId]?.result,
              };
            }
          }
        }
      }
      const updated = { ...ts, messages, tools };
      return {
        tabStates: { ...st.tabStates, [tabId]: updated },
        activeTab: st.activeTabId === tabId ? updated : st.activeTab,
      };
    }),

  handleTabAgentEvent: (tabId, event) =>
    set((st) => {
      const ts = st.tabStates[tabId];
      if (!ts) return {};
      let updated = ts;
      const type = event.type;

      switch (type) {
        case "agent_start":
          updated = { ...ts, piState: { ...ts.piState, isStreaming: true } };
          break;
        case "agent_end":
          // Clone ONLY the message that was streaming — cloning every message
          // here would bust every MessageItem memo at once and re-render the
          // entire conversation at end of turn. (message_end already does the
          // same selective clone below.)
          updated = {
            ...ts,
            messages: ts.messages.map((m) =>
              m.streaming ? { ...m, streaming: false } : m,
            ),
            piState: { ...ts.piState, isStreaming: false },
          };
          break;
        case "message_start": {
          const msg = event.message;
          if (!msg) break;
          const role = msg.role === "assistant" ? "assistant" : msg.role === "user" ? "user" : "system";
          const newMsg: ChatMessage = {
            id: msg.id ?? `${Date.now()}-${Math.random()}`,
            role: role as ChatMessage["role"],
            blocks: extractBlocks(msg),
            streaming: role === "assistant",
            timestamp: msg.timestamp ?? Date.now(),
          };
          updated = { ...ts, messages: [...ts.messages, newMsg] };
          break;
        }
        case "message_update": {
          if (!event.assistantMessageEvent) break;
          updated = { ...ts, messages: applyDelta(event.assistantMessageEvent, ts.messages) };
          break;
        }
        case "message_end": {
          if (!event.message) break;
          // If the assistant message ended with a terminal stop reason (not a
          // tool-use, which continues the turn), reset isStreaming as a safety
          // net. Normally agent_end handles this, but if agent_end is missed or
          // delayed, this prevents the UI from freezing forever.
          const stopReason = (event.message as any)?.stopReason;
          const isTerminal = stopReason === "stop" || stopReason === "length" || stopReason === "content_filter";
          updated = {
            ...ts,
            messages: ts.messages.map((m) =>
              m.streaming ? { ...m, blocks: extractBlocks(event.message), streaming: false } : m,
            ),
            ...(isTerminal ? { piState: { ...ts.piState, isStreaming: false } } : {}),
          };
          break;
        }
        case "tool_execution_start":
          updated = {
            ...ts,
            tools: {
              ...ts.tools,
              [event.toolCallId]: { toolCallId: event.toolCallId, toolName: event.toolName, args: event.args, done: false },
            },
          };
          break;
        case "tool_execution_update":
          updated = {
            ...ts,
            tools: {
              ...ts.tools,
              [event.toolCallId]: {
                ...(ts.tools[event.toolCallId] ?? { toolCallId: event.toolCallId, toolName: event.toolName, done: false }),
                partialResult: event.partialResult,
                toolName: event.toolName,
                args: event.args,
              },
            },
          };
          break;
        case "tool_execution_end":
          updated = {
            ...ts,
            tools: {
              ...ts.tools,
              [event.toolCallId]: {
                ...(ts.tools[event.toolCallId] ?? { toolCallId: event.toolCallId, toolName: event.toolName, done: false }),
                result: event.result,
                isError: event.isError,
                done: true,
              },
            },
          };
          break;
        case "session_info_changed": {
          // Pi 0.80.3: the SDK emits this when a session gets a display name
          // (e.g. an extension or auto-namer renames it). Reflect it live in the
          // tab title so the tab bar stays in sync without a reload.
          const name = typeof event.name === "string" ? event.name.trim() : "";
          if (!name || ts.title === name) break;
          updated = { ...ts, title: name };
          return {
            tabStates: { ...st.tabStates, [tabId]: updated },
            activeTab: st.activeTabId === tabId ? updated : st.activeTab,
            tabs: st.tabs.map((t) => (t.id === tabId ? { ...t, title: name } : t)),
          };
        }
        default:
          break;
      }

      return {
        tabStates: { ...st.tabStates, [tabId]: updated },
        activeTab: st.activeTabId === tabId ? updated : st.activeTab,
      };
    }),

  setActiveView: (v) => set({ activeView: v }),
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
  setSessionsPanelOpen: (o) => set({ sessionsPanelOpen: o }),
  setSdkVersion: (v) => set({ sdkVersion: v }),
  setPackageUpdates: (updates) => set({ packageUpdates: updates }),
  refreshPackageUpdates: async () => {
    try {
      const updates = await window.pi.packages.checkUpdates({});
      set({ packageUpdates: updates ?? [] });
    } catch {
      /* non-fatal — the dot just won't show */
    }
  },
  addDiagnostic: (msg) =>
    set((st) => {
      // Surface diagnostics as readable, auto-dismissing toasts (not just the
      // tiny status bar). Infer severity from the text.
      const level: ExtToast["level"] = /error|fail|unable|couldn'?t|denied/i.test(msg) ? "error" : "info";
      const toast: ExtToast = { id: ++toastSeq, message: msg, level };
      return {
        diagnostics: [...st.diagnostics.slice(-50), msg],
        toasts: [...st.toasts.slice(-4), toast],
      };
    }),

  handleExtUi: (tabId, message) =>
    set((st) => {
      const ts = st.tabStates[tabId];
      const kind = message?.kind;

      // Toasts and dialogs are app-global (not stored per tab).
      if (kind === "notify") {
        const toast: ExtToast = { id: ++toastSeq, message: message.message ?? "", level: message.level ?? "info" };
        return { toasts: [...st.toasts.slice(-4), toast] };
      }
      if (kind === "request") {
        return { extDialog: { ...message.request, tabId } as ExtDialogRequest };
      }

      if (!ts) return {};
      let updated: TabState;

      if (kind === "setStatus") {
        const extStatuses = { ...ts.extStatuses };
        if (message.text == null || message.text === "") delete extStatuses[message.key];
        else extStatuses[message.key] = message.text;
        updated = { ...ts, extStatuses };
      } else if (kind === "setWidget") {
        const extWidgets = { ...ts.extWidgets };
        if (!message.lines) delete extWidgets[message.key];
        else extWidgets[message.key] = { lines: message.lines, placement: message.placement ?? "aboveEditor" };
        updated = { ...ts, extWidgets };
      } else if (kind === "reset") {
        updated = { ...ts, extStatuses: {}, extWidgets: {} };
      } else {
        return {};
      }

      const closeDialog = kind === "reset" && st.extDialog?.tabId === tabId;
      return {
        tabStates: { ...st.tabStates, [tabId]: updated },
        activeTab: st.activeTabId === tabId ? updated : st.activeTab,
        ...(closeDialog ? { extDialog: null } : {}),
      };
    }),

  clearExtDialog: () => set({ extDialog: null }),
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  // Map an AuthEvent push from the main process onto the authFlow UI state.
  handleAuthEvent: (message) =>
    set(() => {
      const kind = message?.kind as string | undefined;
      if (!kind) return {};
      const provider = message.provider as string;
      switch (kind) {
        case "auth":
          return {
            authFlow: {
              provider,
              phase: "browser",
              url: message.url,
              message: message.instructions,
            } as AuthFlow,
          };
        case "deviceCode":
          return {
            authFlow: {
              provider,
              phase: "deviceCode",
              userCode: message.userCode,
              verificationUri: message.verificationUri,
            } as AuthFlow,
          };
        case "progress":
          return {
            authFlow: { provider, phase: "progress", message: message.message } as AuthFlow,
          };
        case "prompt":
          return {
            authFlow: {
              provider,
              phase: "prompt",
              requestId: message.requestId,
              message: message.message,
              placeholder: message.placeholder,
            } as AuthFlow,
          };
        case "select":
          return {
            authFlow: {
              provider,
              phase: "select",
              requestId: message.requestId,
              message: message.message,
              options: message.options,
            } as AuthFlow,
          };
        case "manualCode":
          return {
            authFlow: {
              provider,
              phase: "manualCode",
              requestId: message.requestId,
              message: message.message,
              placeholder: message.placeholder,
            } as AuthFlow,
          };
        case "done":
          // Refresh auth status so the new credential shows as authenticated.
          window.pi.api.getAuthStatus().catch(() => {});
          return { authFlow: null };
        case "error":
          return {
            authFlow: {
              provider,
              phase: "error",
              error: message.message ?? "Login failed.",
            } as AuthFlow,
          };
        default:
          return {};
      }
    }),
  clearAuthFlow: () => set({ authFlow: null }),

  loadAddons: () => {
    window.pi.addons
      .contributions()
      .then(({ panels, statusItems, toolRenderers }) =>
        set((st) => {
          // If the open panel disappeared (package removed), fall back to chat.
          const stillExists = st.activePanelId && panels.some((p) => p.id === st.activePanelId);
          const rendererMap: Record<string, ToolRendererContribution> = {};
          for (const tr of toolRenderers ?? []) rendererMap[tr.tool] = tr;
          return {
            panels,
            statusItems,
            toolRenderers: rendererMap,
            ...(st.activeView === "panel" && !stillExists ? { activeView: "chat" as View, activePanelId: null } : {}),
          };
        }),
      )
      .catch(() => {});
  },

  openPanel: (id) => set({ activeView: "panel", activePanelId: id }),

  // Favorites — persisted to userData/favorites.json via the main process.
  // localStorage was used before but did not survive restarts/updates under the
  // renderer's file:// origin, so favorites appeared to reset.
  loadFavorites: async () => {
    try {
      let favorites = await window.pi.api.getFavorites();
      // One-time migration: if the on-disk store is empty but the old
      // localStorage location still has favorites, carry them over so users
      // don't lose them when upgrading to file-backed persistence.
      if (!favorites || favorites.length === 0) {
        try {
          const legacy = localStorage.getItem("pi-favorites");
          if (legacy) {
            const parsed = JSON.parse(legacy) as Favorite[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              favorites = parsed;
              window.pi.api.setFavorites({ favorites }).catch(() => {});
              localStorage.removeItem("pi-favorites");
            }
          }
        } catch {}
      }
      if (Array.isArray(favorites)) set({ favorites });
    } catch {}
  },

  addFavorite: (path) =>
    set((st) => {
      if (st.favorites.some((f) => f.path === path)) return {};
      const favorites = [...st.favorites, { path, name: path.split("/").pop() || path }];
      window.pi.api.setFavorites({ favorites }).catch(() => {});
      return { favorites };
    }),

  removeFavorite: (path) =>
    set((st) => {
      const favorites = st.favorites.filter((f) => f.path !== path);
      window.pi.api.setFavorites({ favorites }).catch(() => {});
      return { favorites };
    }),
}));

/**
 * Split a raw text string into thinking + text segments.
 *
 * Some models (e.g. DeepSeek) emit reasoning as literal `<think>…</think>`
 * tags *inside* text content, rather than as native SDK `thinking` blocks.
 * Without this, the tags render as raw markdown text. This extracts them into
 * proper thinking blocks so they collapse under the same "Reasoning" toggle as
 * native reasoning. Supports multiple `<think>` segments per message and an
 * unclosed `<think>` (during streaming) which is treated as thinking-through-EOF.
 */
function splitThinkTags(text: string): { kind: "thinking" | "text"; text: string }[] {
  if (!text.includes("<think>")) return [{ kind: "text", text }];
  const segments: { kind: "thinking" | "text"; text: string }[] = [];
  const re = /<think>([\s\S]*?)(<\/think>|$)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Text before the <think> tag (if any).
    if (m.index > last) {
      const before = text.slice(last, m.index);
      if (before.trim()) segments.push({ kind: "text", text: before });
    }
    segments.push({ kind: "thinking", text: m[1] });
    last = m.index + m[0].length;
    // If the tag was unclosed (streaming mid-think), consume the rest and stop.
    if (!m[2]) break;
  }
  // Trailing text after the last closing tag.
  if (last < text.length) {
    const after = text.slice(last);
    if (after.trim()) segments.push({ kind: "text", text: after });
  }
  return segments.length ? segments : [{ kind: "text", text }];
}

function extractBlocks(msg: any): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const content = msg.content;
  // First pass: detect whether the SDK already provided native thinking
  // blocks. Some models emit BOTH a native thinking block AND redundant
  // <think>…</think> tags inside text — in that case we must NOT split the
  // tags into another thinking block (it would duplicate the Reasoning UI).
  // We just strip the tags from the text instead.
  const hasNativeThinking =
    Array.isArray(content) && content.some((c: any) => c.type === "thinking");

  if (typeof content === "string") {
    for (const seg of splitThinkTags(content)) {
      blocks.push(seg.kind === "thinking" ? { type: "thinking", text: seg.text } : { type: "text", text: seg.text });
    }
  } else if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === "text") {
        if (hasNativeThinking) {
          // Native reasoning already exists — just strip any redundant tags
          // from the text so they don't render raw. No new thinking block.
          const stripped = stripThinkTags(c.text ?? "");
          if (stripped.trim()) blocks.push({ type: "text", text: stripped });
        } else {
          // No native thinking — promote <think> tags to thinking blocks
          // (covers tag-only models like DeepSeek).
          for (const seg of splitThinkTags(c.text ?? "")) {
            blocks.push(seg.kind === "thinking" ? { type: "thinking", text: seg.text } : { type: "text", text: seg.text });
          }
        }
      } else if (c.type === "thinking") blocks.push({ type: "thinking", text: c.thinking });
      else if (c.type === "toolCall") blocks.push({ type: "toolCall", toolName: c.name, toolCallId: c.id, arguments: c.arguments });
    }
  }
  return blocks;
}

/** Remove all <think>…</think> segments (and an unclosed trailing <think>…) from text. */
function stripThinkTags(text: string): string {
  if (!text.includes("<think>")) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "");
}

function applyDelta(delta: any, messages: ChatMessage[]): ChatMessage[] {
  const result = [...messages];
  let idx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].streaming) { idx = i; break; }
  }
  if (idx === -1) return result;
  const msg = { ...result[idx], blocks: [...result[idx].blocks] };

  switch (delta.type) {
    case "text_start":
      if (!msg.blocks.some((b) => b.type === "text")) msg.blocks.push({ type: "text", text: "" });
      break;
    case "text_delta": {
      // Append to the current text block, then strip any <think>…</think>
      // segments from what's shown while streaming. We deliberately DON'T try
      // to promote them to a live thinking block here — doing so across deltas
      // is racy (the tag gets consumed on one delta, then later thinking
      // tokens arrive without it and leak into text, producing raw tags and
      // duplicate Reasoning blocks). Final promotion happens once in
      // extractBlocks when the message completes.
      const tb = msg.blocks.find((b) => b.type === "text");
      if (tb) {
        tb.text = stripThinkTags((tb.text ?? "") + (delta.delta ?? ""));
      }
      break;
    }
    case "thinking_start":
      msg.blocks.push({ type: "thinking", text: "" });
      break;
    case "thinking_delta": {
      const tb = [...msg.blocks].reverse().find((b) => b.type === "thinking");
      if (tb) tb.text = (tb.text ?? "") + (delta.delta ?? "");
      break;
    }
    case "toolcall_start":
      msg.blocks.push({ type: "toolCall", toolName: delta.toolCall?.name, toolCallId: delta.toolCall?.id, arguments: {} });
      break;
    case "toolcall_end": {
      const tb = [...msg.blocks].reverse().find((b) => b.type === "toolCall");
      if (tb && delta.toolCall) { tb.toolName = delta.toolCall.name; tb.toolCallId = delta.toolCall.id; tb.arguments = delta.toolCall.arguments; }
      break;
    }
    default:
      break;
  }
  result[idx] = msg;
  return result;
}
