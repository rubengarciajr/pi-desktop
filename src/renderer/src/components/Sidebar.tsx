import { useAppStore } from "../store/useAppStore";
import { ChatIcon, SessionsIcon, ModelIcon, SettingsIcon, ExtensionsIcon, PackagesIcon, PlusIcon, PiLogoIcon, FolderIcon } from "./Icons";
import type { View } from "../store/useAppStore";

const NAV_ITEMS: { id: View | "sessions"; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: "chat", label: "Chat", Icon: ChatIcon },
  { id: "sessions", label: "Sessions", Icon: SessionsIcon },
  { id: "model", label: "Model", Icon: ModelIcon },
  { id: "extensions", label: "Extensions", Icon: ExtensionsIcon },
  { id: "packages", label: "Packages", Icon: PackagesIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

export function Sidebar() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const sessionsPanelOpen = useAppStore((s) => s.sessionsPanelOpen);
  const setSessionsPanelOpen = useAppStore((s) => s.setSessionsPanelOpen);
  const piState = useAppStore((s) => s.activeTab.piState);

  if (!sidebarOpen) return null;

  const handleNewSession = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, cwd });
    useAppStore.getState().addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd });
  };

  const handlePickFolder = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    const tabId = useAppStore.getState().activeTabId;
    if (tabId) await window.pi.api.setCwd({ cwd, tabId });
  };

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-bg-subtle/50 backdrop-blur-xl">
      {/* Drag region — tall enough to clear traffic lights */}
      <div className="drag-region h-14 shrink-0" />

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pb-4">
        <PiLogoIcon size={28} />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-text">Pi Desktop</span>
          <span className="text-[10px] text-text-faint">v0.2.0</span>
        </div>
      </div>

      {/* New session */}
      <div className="px-3 pb-3">
        <button
          onClick={handleNewSession}
          className="no-drag flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-hover px-3 py-2 text-sm font-medium text-text transition-colors hover:border-border-strong hover:bg-bg-active"
        >
          <PlusIcon size={15} />
          New Session
        </button>
      </div>

      {/* Working folder selector */}
      <div className="px-3 pb-3">
        <button
          onClick={handlePickFolder}
          className="no-drag flex w-full items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-bg-hover"
        >
          <FolderIcon size={15} className="shrink-0 text-text-faint" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-text-faint">Working folder</div>
            <div className="truncate text-xs font-mono text-text-muted">
              {piState.cwd ? piState.cwd.split("/").pop() || piState.cwd : "Not set"}
            </div>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="no-drag flex flex-1 flex-col gap-0.5 px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const isSessions = item.id === "sessions";
          const active = isSessions ? sessionsPanelOpen : activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (isSessions) {
                  setSessionsPanelOpen(!sessionsPanelOpen);
                } else {
                  setActiveView(item.id as View);
                }
              }}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-bg-active text-text"
                  : "text-text-muted hover:bg-bg-hover hover:text-text"
              }`}
            >
              <item.Icon size={17} className={active ? "text-accent" : ""} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Session info footer */}
      <div className="no-drag border-t border-border px-4 py-3">
        <div className="mb-0.5 truncate text-xs font-medium text-text">
          {piState.sessionName || (piState.sessionId ? piState.sessionId.slice(0, 8) : "No session")}
        </div>
        <div className="truncate text-[11px] text-text-faint">
          {piState.modelName || "No model selected"}
        </div>
      </div>
    </aside>
  );
}
