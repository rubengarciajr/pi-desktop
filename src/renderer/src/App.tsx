import { useEffect, useState } from "react";
import { useAppStore } from "./store/useAppStore";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { ChatView } from "./components/chat/ChatView";
import { SessionsView } from "./components/sessions/SessionsView";
import { ModelView } from "./components/model/ModelView";
import { SettingsView } from "./components/settings/SettingsView";
import { ExtensionsView } from "./components/extensions/ExtensionsView";
import { PackagesView } from "./components/packages/PackagesView";
import { StatusBar } from "./components/StatusBar";
import { Onboarding } from "./components/Onboarding";
import { UpdateBanner } from "./components/UpdateBanner";

export default function App() {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
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

  // The app runs the pi agent SDK in-process and does NOT require the pi CLI.
  // Skip onboarding entirely - users can optionally install the CLI from System tab.
  useEffect(() => {
    setNeedsOnboarding(false);
  }, []);

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

  // Subscribe to pi events once on mount.
  useEffect(() => {
    const pi = window.pi;
    if (!pi) return;

    const offEvent = pi.events.onEvent((event) => {
      const tabId = (event as any).tabId ?? useAppStore.getState().activeTabId;
      if (tabId) handleTabAgentEvent(tabId, event);
    });
    const offState = pi.events.onState((state: any) => {
      const tabId = state.tabId ?? useAppStore.getState().activeTabId;
      if (tabId) setTabPiState(tabId, state);
    });
    const offQueue = pi.events.onQueue((queue: any) => {
      const tabId = queue.tabId ?? useAppStore.getState().activeTabId;
      if (tabId) setTabQueue(tabId, queue);
    });
    const offDiag = pi.events.onDiagnostics((msg) => addDiagnostic(msg));

    const offReset = pi.events.onSessionReset((data: any) => {
      const tabId = data.tabId ?? useAppStore.getState().activeTabId;
      if (!tabId) return;
      resetTabMessages(tabId);
      window.pi.api.getMessages({ tabId }).then((raw) => {
        if (Array.isArray(raw) && raw.length > 0) loadTabMessages(tabId, raw as any[]);
      }).catch(() => {});
    });

    const offMenu = pi.events.onMenu(async (action) => {
      switch (action) {
        case "newSession": {
          const cwd = await window.pi.api.pickDirectory();
          if (!cwd) return;
          const tabId = `tab-${Date.now()}`;
          await window.pi.api.createTab({ tabId, cwd });
          addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd });
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
      offReset();
      offMenu();
    };
  }, [handleTabAgentEvent, setTabPiState, setTabQueue, loadTabMessages, resetTabMessages, addDiagnostic, addTab, setActiveView, setSidebarOpen]);

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

  // Show onboarding if pi CLI is not installed.
  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  // Still checking, show nothing (prevents flash).
  if (needsOnboarding === null) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {hasTabs && <TabBar />}
        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-hidden">
            {activeView === "chat" && (hasTabs ? <ChatView /> : <div className="flex h-full items-center justify-center text-text-muted">No active tab</div>)}
            {activeView === "model" && <ModelView />}
            {activeView === "settings" && <SettingsView />}
            {activeView === "extensions" && <ExtensionsView />}
            {activeView === "packages" && <PackagesView />}
          </div>
          {/* Sessions panel (persistent drawer) */}
          {sessionsPanelOpen && (
            <div className="flex w-80 shrink-0 flex-col border-l border-border bg-bg-subtle/50 backdrop-blur-xl">
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
    </div>
  );
}
