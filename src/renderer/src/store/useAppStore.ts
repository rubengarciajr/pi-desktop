import { create } from "zustand";

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

export type View = "chat" | "model" | "settings" | "extensions" | "packages";

export interface TabState {
  id: string;
  title: string;
  cwd?: string;
  messages: ChatMessage[];
  tools: Record<string, ToolExecution>;
  piState: PiState;
  queue: QueueState;
}

export interface Tab {
  id: string;
  title: string;
  cwd?: string;
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

  // Derived (from active tab)
  activeTab: TabState;

  // Tab actions
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;

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

  // Favorites actions
  addFavorite: (path: string) => void;
  removeFavorite: (path: string) => void;
  loadFavorites: () => void;
}

function emptyTabState(id: string, title: string, cwd?: string): TabState {
  return {
    id,
    title,
    cwd,
    messages: [],
    tools: {},
    piState: { cwd },
    queue: { steering: [], followUp: [] },
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  tabStates: {},
  favorites: [],
  activeView: "chat",
  sidebarOpen: true,
  sessionsPanelOpen: false,
  diagnostics: [],
  activeTab: emptyTabState("", ""),

  addTab: (tab) =>
    set((st) => ({
      tabs: [...st.tabs, tab],
      tabStates: {
        ...st.tabStates,
        [tab.id]: emptyTabState(tab.id, tab.title, tab.cwd),
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
    set((st) => ({
      tabs: st.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      tabStates: {
        ...st.tabStates,
        [id]: st.tabStates[id]
          ? { ...st.tabStates[id], title: patch.title ?? st.tabStates[id].title, cwd: patch.cwd ?? st.tabStates[id].cwd }
          : st.tabStates[id],
      },
    })),

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
    set((st) => ({ diagnostics: [...st.diagnostics.slice(-50), msg] })),

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
