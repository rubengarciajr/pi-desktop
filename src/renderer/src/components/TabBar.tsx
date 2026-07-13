import { useAppStore } from "../store/useAppStore";
import { PlusIcon, FolderIcon, PiRoutingIcon } from "./Icons";
import { GitDirtyDot } from "./GitRepoBadge";

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const removeTab = useAppStore((s) => s.removeTab);
  const tabStates = useAppStore((s) => s.tabStates);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const path = (file as any).path;
    if (!path) return;
    // A folder can only be open in one tab — focus it if already open.
    if (useAppStore.getState().focusExistingTab(path)) return;
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, cwd: path });
    useAppStore.getState().addTab({ id: tabId, title: path.split("/").pop() || path, cwd: path });
  };

  return (
    <div
      className="drag-region flex items-end gap-0.5 border-b border-border bg-bg-subtle/30 px-2"
      style={{ height: 36, paddingTop: 28 }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const ts = tabStates[tab.id];
        const isStreaming = ts?.piState?.isStreaming;
        const moaActive = ts?.moaActivity && ts.moaActivity.phase !== "complete";
        return (
          <div
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              // Selecting a tab always returns to the chat view, so the user
              // isn't left looking at Settings/Extensions/etc. after clicking a
              // tab. Matches the sidebar's view-switching behavior.
              useAppStore.getState().setActiveView("chat");
            }}
            className={`no-drag group relative flex cursor-default items-center gap-1.5 py-1 transition-colors ${
              active ? "bg-bg text-text" : "text-text-muted hover:bg-bg-hover"
            }`}
            style={{ marginBottom: -1, paddingLeft: 8, paddingRight: 4, fontSize: 11 }}
          >
            {/* Top border only for active tab - spans content with padding */}
            {active && (
              <div className="absolute inset-x-0 top-0 border-t border-l border-r border-border bg-bg" style={{ height: "100%", zIndex: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
            )}
            {/* Content sits above the border layer */}
            <div className="relative flex items-center gap-1.5" style={{ zIndex: 1 }}>
              {isStreaming && (
                <span className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-accent" />
              )}
              {/* Pi Routing (MOA) active on this tab — show the routing icon */}
              {moaActive && (
                <PiRoutingIcon size={10} className="animate-pulse-subtle text-accent" />
              )}
              <FolderIcon size={11} className="text-text-faint" />
              {active && tab.cwd && <GitDirtyDot cwd={tab.cwd} tabId={tab.id} />}
              {/* Tag Team tabs show a small badge instead of the folder icon */}
              {tab.id.startsWith("tagteam-") && (
                <span className="rounded bg-accent/20 px-1 text-[9px] font-bold uppercase text-accent" title="Tag Team relay tab">
                  TAG
                </span>
              )}
              <span className="max-w-[100px] truncate" style={{ padding: "1px 2px", background: active ? "var(--color-bg)" : "var(--color-bg-subtle)" }}>{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.pi.api.removeTab({ tabId: tab.id });
                  removeTab(tab.id);
                  // Closing a tab also returns to chat for the same reason as
                  // selecting one — don't leave the user stranded in a settings
                  // view looking at whichever tab became active.
                  useAppStore.getState().setActiveView("chat");
                }}
                className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded text-text-faint opacity-0 transition-opacity hover:bg-bg-active hover:text-text group-hover:opacity-100"
                style={{ fontSize: 13, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
      {/* New tab button - padded to avoid border line */}
      <button
        onClick={async () => {
          const cwd = await window.pi.api.pickDirectory();
          if (!cwd) return;
          // A folder can only be open in one tab — focus it if already open.
          if (useAppStore.getState().focusExistingTab(cwd)) return;
          const tabId = `tab-${Date.now()}`;
          await window.pi.api.createTab({ tabId, cwd });
          useAppStore.getState().addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd });
        }}
        className="no-drag mb-[-1px] flex items-center justify-center rounded text-text-faint transition-colors hover:bg-bg-hover hover:text-text"
        style={{ height: 24, width: 24, fontSize: 11, marginLeft: 2, marginBottom: 2, background: "var(--color-bg-subtle)" }}
        title="New tab"
      >
        <PlusIcon size={13} />
      </button>
    </div>
  );
}
