import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { PlusIcon, FolderIcon } from "../Icons";
import { GitRepoHeader } from "../GitRepoBadge";

interface SessionItem {
  id: string;
  file: string;
  name?: string;
  cwd?: string;
  timestamp?: number;
  messageCount?: number;
  firstMessage?: string;
}

export function SessionsView() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const addTab = useAppStore((s) => s.addTab);
  const focusExistingTab = useAppStore((s) => s.focusExistingTab);
  const favorites = useAppStore((s) => s.favorites);
  const addFavorite = useAppStore((s) => s.addFavorite);
  const removeFavorite = useAppStore((s) => s.removeFavorite);
  const setSessionsPanelOpen = useAppStore((s) => s.setSessionsPanelOpen);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await window.pi.api.listAllSessions();
      setSessions(list as SessionItem[]);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleNew = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    // A folder can only be open in one tab — focus it if it's already open.
    if (focusExistingTab(cwd)) return;
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, cwd });
    addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd });
    await refresh();
  };

  // Group sessions by working directory.
  const grouped = sessions.reduce((acc, s) => {
    const dir = s.cwd || "Unknown";
    (acc[dir] ??= []).push(s);
    return acc;
  }, {} as Record<string, SessionItem[]>);

  const isFavorite = (path: string) => favorites.some((f) => f.path === path);

  const toggleFavorite = (path: string) => {
    if (isFavorite(path)) removeFavorite(path);
    else addFavorite(path);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Compact header */}
      <div className="no-drag flex items-center justify-between px-4 pb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleNew}
            className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-hover"
          >
            <PlusIcon size={11} />
            New
          </button>
          <button
            onClick={refresh}
            className="rounded-lg border border-border bg-bg-hover px-2 py-1 text-[11px] text-text-muted hover:bg-bg-active"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="px-2 py-4 text-xs text-text-muted">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderIcon size={32} className="mb-2 text-text-faint" />
            <p className="text-xs text-text-muted">No sessions yet.</p>
            <p className="mt-1 text-[11px] text-text-faint">
              Click "New" to pick a folder.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Favorites section */}
            {favorites.length > 0 && (
              <div>
                <h3 className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-text-faint">
                  Favorites
                </h3>
                <div className="space-y-0.5">
                  {favorites.map((f) => (
                    <div
                      key={f.path}
                      className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-bg-hover"
                    >
                      <button
                        onClick={async () => {
                          // Opening a favorite auto-closes the Sessions panel
                          // (only favorites do this — regular session items don't).
                          setSessionsPanelOpen(false);
                          // A folder can only be open in one tab — focus it if
                          // it's already open instead of cloning.
                          if (focusExistingTab(f.path)) return;
                          const tabId = `tab-${Date.now()}`;
                          await window.pi.api.createTab({ tabId, cwd: f.path });
                          addTab({ id: tabId, title: f.name, cwd: f.path });
                          // Find the most recent session in this folder and load it.
                          const folderSessions = sessions.filter((s) => s.cwd === f.path);
                          if (folderSessions.length > 0) {
                            const mostRecent = folderSessions.sort((a, b) =>
                              (b.timestamp ?? 0) - (a.timestamp ?? 0)
                            )[0];
                            await window.pi.api.switchSession({
                              sessionPath: mostRecent.file,
                              cwd: f.path,
                              tabId,
                            });
                          }
                        }}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        title={f.path}
                      >
                        <StarIcon size={11} filled />
                        <FolderIcon size={11} className="shrink-0 text-text-faint" />
                        <span className="truncate text-xs text-text">{f.name}</span>
                      </button>
                      <button
                        onClick={() => removeFavorite(f.path)}
                        className="shrink-0 text-text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                        title="Remove from favorites"
                      >
                        <StarIcon size={11} filled />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions grouped by folder */}
            {Object.entries(grouped).map(([dir, dirSessions]) => (
              <div key={dir}>
                {/* Folder header with star */}
                <div className="mb-1 flex items-center gap-1.5 px-1">
                  <button
                    onClick={() => toggleFavorite(dir)}
                    className="text-text-faint transition-colors hover:text-warning"
                    title={isFavorite(dir) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <StarIcon size={11} filled={isFavorite(dir)} />
                  </button>
                  <FolderIcon size={11} className="text-text-faint" />
                  <span className="truncate text-[11px] font-medium text-text-muted">{dir.split("/").pop() || dir}</span>
                  <span className="text-[10px] text-text-faint">({dirSessions.length})</span>
                </div>
                {/* Git info */}
                <div className="mb-1 px-1">
                  <GitRepoHeader cwd={dir} />
                </div>
                {/* Session items */}
                <div className="space-y-0.5">
                  {dirSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={async () => {
                        // A folder can only be open in one tab — if it's already
                        // open, focus that tab instead of cloning the session.
                        if (focusExistingTab(s.cwd)) return;
                        const tabId = `tab-${Date.now()}`;
                        await window.pi.api.createTab({ tabId, cwd: s.cwd });
                        addTab({ id: tabId, title: s.cwd?.split("/").pop() || s.name || s.id.slice(0, 8), cwd: s.cwd });
                        await window.pi.api.switchSession({ sessionPath: s.file, cwd: s.cwd, tabId });
                      }}
                      className="no-drag flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-text">
                          {s.name || s.firstMessage?.slice(0, 50) || s.id.slice(0, 8)}
                        </div>
                        <div className="truncate text-[10px] text-text-faint">
                          {s.timestamp ? new Date(s.timestamp).toLocaleDateString() : ""}
                        </div>
                      </div>
                      {s.messageCount != null && (
                        <span className="ml-2 shrink-0 text-[10px] text-text-faint">
                          {s.messageCount} msgs
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StarIcon({ size = 14, filled }: { size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
