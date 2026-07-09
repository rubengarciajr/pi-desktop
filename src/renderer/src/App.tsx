import { lazy, Suspense, useEffect, useRef } from "react";
import { useAppStore } from "./store/useAppStore";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { ChatView } from "./components/chat/ChatView";
import { SessionsView } from "./components/sessions/SessionsView";
import { StatusBar } from "./components/StatusBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { ExtensionDialog, ExtensionToasts } from "./components/extensions/ExtensionUi";
import { AuthFlowModal } from "./components/AuthFlowModal";
import { PanelView } from "./components/extensions/PanelView";

// Secondary views are code-split so their (considerable) code — settings,
// extensions marketplace, package manager, model picker — loads on demand
// instead of upfront in the initial bundle. The chat view stays eager since
// it's what the user sees on launch.
const ModelView = lazy(() =>
  import("./components/model/ModelView").then((m) => ({ default: m.ModelView })),
);
const SettingsView = lazy(() =>
  import("./components/settings/SettingsView").then((m) => ({ default: m.SettingsView })),
);
const ExtensionsView = lazy(() =>
  import("./components/extensions/ExtensionsView").then((m) => ({ default: m.ExtensionsView })),
);
const PackagesView = lazy(() =>
  import("./components/packages/PackagesView").then((m) => ({ default: m.PackagesView })),
);
const TagTeamView = lazy(() =>
  import("./components/settings/TagTeamView").then((m) => ({ default: m.TagTeamView })),
);

export default function App() {
  const activeView = useAppStore((s) => s.activeView);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const sessionsPanelOpen = useAppStore((s) => s.sessionsPanelOpen);
  const setSessionsPanelOpen = useAppStore((s) => s.setSessionsPanelOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const addTab = useAppStore((s) => s.addTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const handleTabAgentEvent = useAppStore((s) => s.handleTabAgentEvent);
  const setTabPiState = useAppStore((s) => s.setTabPiState);
  const setTabQueue = useAppStore((s) => s.setTabQueue);
  const loadTabMessages = useAppStore((s) => s.loadTabMessages);
  const resetTabMessages = useAppStore((s) => s.resetTabMessages);
  const addDiagnostic = useAppStore((s) => s.addDiagnostic);
  const handleExtUi = useAppStore((s) => s.handleExtUi);
  const handleAuthEvent = useAppStore((s) => s.handleAuthEvent);
  const panels = useAppStore((s) => s.panels);
  const activePanelId = useAppStore((s) => s.activePanelId);
  const loadAddons = useAppStore((s) => s.loadAddons);

  // On launch, open a ready-to-type Chat tab so the user can start immediately
  // (no folder picker). Runs once; skips if a tab already exists.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (useAppStore.getState().tabs.length > 0) return;
    const tabId = `tab-${Date.now()}`;
    window.pi.api
      .createTab({ tabId, mode: "chat" })
      .then(() => addTab({ id: tabId, title: "Chat", mode: "chat" }))
      .catch(() => {});
  }, [addTab]);

  // Apply saved theme and accent on mount.
  useEffect(() => {
    const savedTheme = localStorage.getItem("pi-theme") || "system";
    const savedAccent = localStorage.getItem("pi-accent") || "purple";
    document.documentElement.setAttribute("data-accent", savedAccent);
    if (savedTheme !== "system") {
      document.documentElement.setAttribute("data-theme", savedTheme);
      window.pi.events.setTheme(savedTheme as any);
    } else {
      window.pi.events.getTheme().then((t) => {
        document.documentElement.setAttribute("data-theme", t.shouldUseDarkColors ? "dark" : "light");
      });
    }
  }, []);

  // Listen for system theme changes and update if in "system" mode.
  useEffect(() => {
    const off = window.pi.events.onThemeChanged((data: any) => {
      const savedTheme = localStorage.getItem("pi-theme") || "system";
      if (savedTheme === "system") {
        document.documentElement.setAttribute("data-theme", data.shouldUseDarkColors ? "dark" : "light");
      }
    });
    return () => { off?.(); };
  }, []);

  // Load favorites on mount.
  useEffect(() => {
    useAppStore.getState().loadFavorites();
  }, []);

  // Resolve the installed Pi SDK version from the SDK's own VERSION export so
  // the displayed version never drifts after a bump (the preload's value is a
  // static fallback only).
  useEffect(() => {
    window.pi.api
      .getSdkVersion()
      .then((v: string) => {
        if (v) useAppStore.getState().setSdkVersion(v);
      })
      .catch(() => {});
  }, []);

  // Check configured packages for available updates on mount — drives the
  // orange "update" dot on the Extensions nav item and the Update buttons.
  useEffect(() => {
    useAppStore.getState().refreshPackageUpdates();
  }, []);

  // Subscribe to pi events once on mount.
  useEffect(() => {
    const pi = window.pi;
    if (!pi) return;

    const offEvent = pi.events.onEvent((event) => {
      // Per-tab events MUST have a tabId. Dropping events without one
      // prevents background-tab events from being applied to the active tab.
      const tabId = (event as any).tabId;
      if (tabId) handleTabAgentEvent(tabId, event);
    });
    const offState = pi.events.onState((state: any) => {
      const tabId = state.tabId;
      if (tabId) setTabPiState(tabId, state);
    });
    const offQueue = pi.events.onQueue((queue: any) => {
      const tabId = queue.tabId;
      if (tabId) setTabQueue(tabId, queue);
    });
    const offDiag = pi.events.onDiagnostics((msg) => addDiagnostic(msg));

    // Load addon contributions (panels/status items) + refresh when packages change.
    loadAddons();
    // Re-check for updates too, so the orange dot clears after an update and
    // appears when a newly-installed package has a newer version.
    const offPkgChanged = pi.events.onPackagesChanged(() => {
      loadAddons();
      useAppStore.getState().refreshPackageUpdates();
    });

    const offExtUi = pi.events.onExtUi((message: any) => {
      const tabId = message?.tabId;
      // Tag Team handoff: Model A finished, a new tab was created for Model B.
      // Add the tab to the store and switch to it.
      if (message?.type === "tagteam:handoff" && message.toTabId) {
        const toTabId = message.toTabId as string;
        // Only add if not already present (idempotent — ext-ui can fire twice).
        if (!useAppStore.getState().tabs.find((t) => t.id === toTabId)) {
          addTab({
            id: toTabId,
            title: message.toModel ?? "Tag Team",
            mode: "chat",
          });
        }
        setActiveTab(toTabId);
        window.pi.api.setActiveTab({ tabId: toTabId }).catch(() => {});
        return;
      }
      if (tabId) handleExtUi(tabId, message);
    });

    // OAuth login-flow events (browser opened, device code, input prompts).
    // Auth is shared/global, so these don't need a tabId gate.
    const offAuth = pi.events.onAuthEvent((message: any) => {
      handleAuthEvent(message);
    });

    const offReset = pi.events.onSessionReset((data: any) => {
      const tabId = data.tabId;
      if (!tabId) return;
      resetTabMessages(tabId);
      window.pi.api.getMessages({ tabId }).then((raw) => {
        if (Array.isArray(raw) && raw.length > 0) loadTabMessages(tabId, raw as any[]);
      }).catch(() => {});
    });

    const offMenu = pi.events.onMenu(async (action) => {
      switch (action) {
        case "newSession": {
          const tabId = `tab-${Date.now()}`;
          if (useAppStore.getState().defaultTabMode === "chat") {
            await window.pi.api.createTab({ tabId, mode: "chat" });
            addTab({ id: tabId, title: "Chat", mode: "chat" });
            break;
          }
          const cwd = await window.pi.api.pickDirectory();
          if (!cwd) return;
          // A folder can only be open in one tab — focus it if already open.
          if (useAppStore.getState().focusExistingTab(cwd)) break;
          await window.pi.api.createTab({ tabId, cwd, mode: "code" });
          addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd, mode: "code" });
          break;
        }
        case "switchSession":
          setSessionsPanelOpen(!useAppStore.getState().sessionsPanelOpen);
          break;
        case "toggleSidebar":
          setSidebarOpen(!useAppStore.getState().sidebarOpen);
          break;
        case "cycleModel":
          window.pi.api.cycleModel({ tabId: useAppStore.getState().activeTabId ?? undefined }).then((s: any) => {
            const tid = useAppStore.getState().activeTabId;
            if (tid && s) setTabPiState(tid, s);
          });
          break;
        case "cycleThinking":
          window.pi.api.cycleThinkingLevel({ tabId: useAppStore.getState().activeTabId ?? undefined });
          break;
        case "compact":
          window.pi.api.compact({ tabId: useAppStore.getState().activeTabId ?? undefined });
          break;
        case "abort":
          window.pi.api.abort({ tabId: useAppStore.getState().activeTabId ?? undefined });
          break;
        case "focusPrompt":
          window.dispatchEvent(new CustomEvent("pi:focusPrompt"));
          break;
      }
    });

    return () => {
      offEvent();
      offState();
      offQueue();
      offDiag();
      offPkgChanged();
      offExtUi();
      offAuth();
      offReset();
      offMenu();
    };
  }, [handleTabAgentEvent, setTabPiState, setTabQueue, loadTabMessages, resetTabMessages, addDiagnostic, handleExtUi, handleAuthEvent, loadAddons, addTab, setActiveView, setSidebarOpen, setActiveTab, setSessionsPanelOpen]);

  // Sync active tab to backend when renderer switches tabs.
  useEffect(() => {
    if (activeTabId) {
      window.pi.api.setActiveTab({ tabId: activeTabId }).catch(() => {});
    }
  }, [activeTabId]);

  // Fetch initial state for the active tab on mount.
  useEffect(() => {
    if (tabs.length === 0 || !activeTabId) return;
    const tabId = activeTabId;
    window.pi.api.getState({ tabId }).then((state: any) => {
      setTabPiState(tabId, state);
      if (state?.cwd) {
        useAppStore.getState().updateTab(tabId, { title: state.cwd.split("/").pop() || "Home", cwd: state.cwd });
      }
    }).catch(() => {});
    window.pi.api.getMessages({ tabId }).then((raw) => {
      if (Array.isArray(raw) && raw.length > 0) loadTabMessages(tabId, raw as any[]);
    }).catch(() => {});
  }, [activeTabId, tabs.length]); // eslint-disable-line

  const hasTabs = tabs.length > 0 && activeTabId;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {hasTabs && <TabBar />}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {/* Main content */}
          <div className="min-w-0 flex-1 overflow-hidden">
            {activeView === "chat" && (hasTabs ? <ChatView /> : <div className="flex h-full items-center justify-center text-text-muted">No active tab</div>)}
            {activeView === "model" && (
              <Suspense fallback={null}>
                <ModelView />
              </Suspense>
            )}
            {activeView === "settings" && (
              <Suspense fallback={null}>
                <SettingsView />
              </Suspense>
            )}
            {activeView === "extensions" && (
              <Suspense fallback={null}>
                <ExtensionsView />
              </Suspense>
            )}
            {activeView === "packages" && (
              <Suspense fallback={null}>
                <PackagesView />
              </Suspense>
            )}
            {activeView === "tagteam" && (
              <Suspense fallback={null}>
                <TagTeamView />
              </Suspense>
            )}
            {activeView === "panel" && <PanelView panel={panels.find((p) => p.id === activePanelId)} />}
          </div>
          {/* Sessions panel (persistent drawer) */}
          {sessionsPanelOpen && (
            <div className="flex w-80 shrink-0 flex-col border-l border-border-strong bg-bg-subtle">
              <div className="no-drag flex h-12 shrink-0 items-center justify-between px-4 pt-7">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">Sessions</span>
                <button
                  onClick={() => setSessionsPanelOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-bg-hover hover:text-text"
                  title="Close"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <SessionsView />
            </div>
          )}
        </div>
        <StatusBar />
      </main>
      <UpdateBanner />
      <ExtensionToasts />
      <ExtensionDialog />
      <AuthFlowModal />
    </div>
  );
}
