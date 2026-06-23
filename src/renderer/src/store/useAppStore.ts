import { create } from "zustand";
import type { PanelContribution, StatusItemContribution } from "../../../shared/ipc";

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
}

export interface QueueState {
  steering: string[];
  followUp: string[];
}

export type View = "chat" | "model" | "settings" | "extensions" | "packages" | "panel";

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

export interface ExtToast {
  id: number;
  message: string;
  level: "info" | "warning" | "error";
}

export type TabMode = "chat" | "code";

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

  // Addon contributions (Tier 2: declarative panels + status items)
  panels: PanelContribution[];
  statusItems: StatusItemContribution[];
  activePanelId: string | null;

  // Default mode for new tabs (Chat/Code toggle), persisted to localStorage.
  defaultTabMode: TabMode;

  // Derived (from active tab)
  activeTab: TabState;

  // Tab actions
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  setDefaultTabMode: (mode: TabMode) => void;

  // Per-tab state actions
  setTabPiState: (tabId: string, s: Partial<PiState>) => void;
  setTabQueue: (tabId: string, q: QueueState) => void;
  resetTabMessages: (tabId: string) => void;
  loadTabMessages: (tabId: string, rawMessages: any[]) => void;
  handleTabAgentEvent: (tabId: string, event: any) => void;

  // UI actions
  setActiveView: (v: View) => void;
  setSidebarOpen: (o: boolean) => void;
  setSessionsPanelOpen: (o: boolean) => void;
  addDiagnostic: (msg: string) => void;

  // Extension UI actions
  handleExtUi: (tabId: string, message: any) => void;
  clearExtDialog: () => void;
  dismissToast: (id: number) => void;

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
  panels: [],
  statusItems: [],
  activePanelId: null,
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
    // Never let state events override isStreaming.
    const { isStreaming: _ignored, ...rest } = s as any;
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
          updated = {
            ...ts,
            messages: ts.messages.map((m) => ({ ...m, streaming: false })),
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
          updated = {
            ...ts,
            messages: ts.messages.map((m) =>
              m.streaming ? { ...m, blocks: extractBlocks(event.message), streaming: false } : m,
            ),
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

  loadAddons: () => {
    window.pi.addons
      .contributions()
      .then(({ panels, statusItems }) =>
        set((st) => {
          // If the open panel disappeared (package removed), fall back to chat.
          const stillExists = st.activePanelId && panels.some((p) => p.id === st.activePanelId);
          return {
            panels,
            statusItems,
            ...(st.activeView === "panel" && !stillExists ? { activeView: "chat" as View, activePanelId: null } : {}),
          };
        }),
      )
      .catch(() => {});
  },

  openPanel: (id) => set({ activeView: "panel", activePanelId: id }),

  // Favorites
  loadFavorites: () => {
    try {
      const stored = localStorage.getItem("pi-favorites");
      if (stored) {
        const favorites = JSON.parse(stored) as Favorite[];
        set({ favorites });
      }
    } catch {}
  },

  addFavorite: (path) =>
    set((st) => {
      if (st.favorites.some((f) => f.path === path)) return {};
      const favorites = [...st.favorites, { path, name: path.split("/").pop() || path }];
      try { localStorage.setItem("pi-favorites", JSON.stringify(favorites)); } catch {}
      return { favorites };
    }),

  removeFavorite: (path) =>
    set((st) => {
      const favorites = st.favorites.filter((f) => f.path !== path);
      try { localStorage.setItem("pi-favorites", JSON.stringify(favorites)); } catch {}
      return { favorites };
    }),
}));

function extractBlocks(msg: any): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const content = msg.content;
  if (typeof content === "string") {
    blocks.push({ type: "text", text: content });
  } else if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === "text") blocks.push({ type: "text", text: c.text });
      else if (c.type === "thinking") blocks.push({ type: "thinking", text: c.thinking });
      else if (c.type === "toolCall") blocks.push({ type: "toolCall", toolName: c.name, toolCallId: c.id, arguments: c.arguments });
    }
  }
  return blocks;
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
      const tb = msg.blocks.find((b) => b.type === "text");
      if (tb) tb.text = (tb.text ?? "") + (delta.delta ?? "");
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
