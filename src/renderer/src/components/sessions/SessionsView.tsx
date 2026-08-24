import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { PlusIcon, FolderIcon, BranchIcon } from "../Icons";
import { GitRepoHeader } from "../GitRepoBadge";
import { FilePathMenu, type FilePathAction } from "../chat/FilePathMenu";

interface SessionItem {
  id: string;
  file: string;
  name?: string;
  cwd?: string;
  timestamp?: number;
  messageCount?: number;
  firstMessage?: string;
}

/** Managed worktrees live under ~/.pi/worktrees/… — cheap renderer-side gate
 *  for showing worktree actions (the main process re-verifies before acting). */
const isManagedWorktreePath = (p?: string) => !!p && p.includes("/.pi/worktrees/");

export function SessionsView() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: SessionItem } | null>(null);
  // "New Worktree" flow: repo picked, waiting for a branch name.
  const [worktreeModal, setWorktreeModal] = useState<{ repoPath: string } | null>(null);
  const [branchInput, setBranchInput] = useState("");
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [worktreeBusy, setWorktreeBusy] = useState(false);
  const addTab = useAppStore((s) => s.addTab);
  const tabs = useAppStore((s) => s.tabs);
  const removeTabFromStore = useAppStore((s) => s.removeTab);
  const focusExistingTab = useAppStore((s) => s.focusExistingTab);
  const favorites = useAppStore((s) => s.favorites);
  const addFavorite = useAppStore((s) => s.addFavorite);
  const removeFavorite = useAppStore((s) => s.removeFavorite);
  const setSessionsPanelOpen = useAppStore((s) => s.setSessionsPanelOpen);
  // The session file of the active tab, so we can mark the open session.
  const activeSessionFile = useAppStore((s) => s.activeTab.piState.sessionFile);
  const activeCwd = useAppStore((s) => s.activeTab.piState.cwd ?? s.activeTab.cwd);

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

  const handleNewWorktree = async () => {
    const repoPath = await window.pi.api.pickDirectory();
    if (!repoPath) return;
    setBranchInput("");
    setWorktreeError(null);
    setWorktreeModal({ repoPath });
  };

  const createWorktree = async () => {
    if (!worktreeModal || worktreeBusy) return;
    const branch = branchInput.trim();
    if (!branch) return;
    setWorktreeBusy(true);
    setWorktreeError(null);
    try {
      const tabId = `tab-${Date.now()}`;
      const res = await window.pi.api.createWorktreeSession({
        tabId,
        repoPath: worktreeModal.repoPath,
        branch,
      });
      if (!res.success) {
        setWorktreeError(res.error || "Failed to create worktree.");
        return;
      }
      addTab({ id: tabId, title: `⑂ ${res.branch}`, cwd: res.worktreePath });
      setWorktreeModal(null);
      await refresh();
    } catch (err: any) {
      setWorktreeError(err?.message ?? String(err));
    } finally {
      setWorktreeBusy(false);
    }
  };

  const handleRemoveWorktree = async (worktreePath: string) => {
    try {
      let res = await window.pi.api.removeWorktree({ worktreePath });
      if (!res.success && res.error === "DIRTY_WORKTREE") {
        const discard = window.confirm(
          "This worktree has uncommitted changes. Remove it anyway and discard them?",
        );
        if (!discard) return;
        res = await window.pi.api.removeWorktree({ worktreePath, force: true });
      }
      if (!res.success) {
        console.error("[sessions] Failed to remove worktree:", res.error);
        window.alert(`Could not remove worktree:\n${res.error}`);
        return;
      }
      // The checkout is gone — close any tab still pointing at it, or every
      // action in that tab would fail against a deleted directory.
      for (const t of tabs.filter((t) => t.cwd === worktreePath)) {
        try {
          await window.pi.api.removeTab({ tabId: t.id });
        } catch {
          // Main-side manager may already be gone; still drop the UI tab.
        }
        removeTabFromStore(t.id);
      }
      await refresh();
    } catch (err) {
      console.error("[sessions] Failed to remove worktree:", err);
    }
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
      <div className="no-drag flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={handleNew}
            className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-hover"
          >
            <PlusIcon size={11} />
            New
          </button>
          <button
            onClick={handleNewWorktree}
            className="flex items-center gap-1 rounded-lg border border-border bg-bg-hover px-2 py-1 text-[11px] text-text-muted hover:bg-bg-active"
            title="Create an isolated git worktree on a new branch and open a session in it"
          >
            <BranchIcon size={11} />
            Worktree
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
                <h3 className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-text-faint">
                  Favorites
                </h3>
                <div className="space-y-1.5">
                  {favorites.map((f) => {
                    const isActiveFolder = activeCwd === f.path;
                    return (
                      <div
                        key={f.path}
                        className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-2 transition-colors ${
                          isActiveFolder
                            ? "border-accent/40 bg-accent/10"
                            : "border-border bg-bg-hover hover:border-border-strong hover:bg-bg-active"
                        }`}
                      >
                        <button
                          onClick={async () => {
                            setSessionsPanelOpen(false);
                            if (focusExistingTab(f.path)) return;
                            const tabId = `tab-${Date.now()}`;
                            await window.pi.api.createTab({ tabId, cwd: f.path });
                            addTab({ id: tabId, title: f.name, cwd: f.path });
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
                          {isActiveFolder && (
                            <span className="ml-auto shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-medium text-accent">
                              open
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => removeFavorite(f.path)}
                          className="shrink-0 text-text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                          title="Remove from favorites"
                        >
                          <StarIcon size={11} filled />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sessions grouped by folder */}
            {Object.entries(grouped).map(([dir, dirSessions]) => {
              const isFolderActive = activeCwd === dir;
              return (
                <div key={dir}>
                  {/* Folder header with star */}
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <button
                      onClick={() => toggleFavorite(dir)}
                      className="text-text-faint transition-colors hover:text-warning"
                      title={isFavorite(dir) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <StarIcon size={11} filled={isFavorite(dir)} />
                    </button>
                    <FolderIcon size={11} className={isFolderActive ? "text-accent" : "text-text-faint"} />
                    <span className={`truncate text-[11px] font-medium ${isFolderActive ? "text-accent" : "text-text-muted"}`}>
                      {dir.split("/").pop() || dir}
                    </span>
                    <span className="text-[10px] text-text-faint">({dirSessions.length})</span>
                  </div>
                  {/* Git info */}
                  <div className="mb-2 px-1">
                    <GitRepoHeader cwd={dir} />
                  </div>
                  {/* Session cards */}
                  <div className="space-y-1.5">
                    {dirSessions.map((s) => {
                      const isActive = s.file === activeSessionFile;
                      const isFav = isFavorite(s.cwd || "");
                      return (
                        <button
                          key={s.id}
                          onClick={async () => {
                            if (focusExistingTab(s.cwd)) return;
                            const tabId = `tab-${Date.now()}`;
                            await window.pi.api.createTab({ tabId, cwd: s.cwd });
                            addTab({ id: tabId, title: s.cwd?.split("/").pop() || s.name || s.id.slice(0, 8), cwd: s.cwd });
                            await window.pi.api.switchSession({ sessionPath: s.file, cwd: s.cwd, tabId });
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({ x: e.clientX, y: e.clientY, session: s });
                          }}
                          className={`no-drag flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-all ${
                            isActive
                              ? "border-accent/50 bg-accent/10 shadow-[0_0_0_1px_rgb(var(--color-accent-rgb)/0.2)]"
                              : "border-border bg-bg-hover hover:border-border-strong hover:bg-bg-active"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-xs font-medium ${isActive ? "text-accent" : "text-text"}`}>
                              {s.name || s.firstMessage?.slice(0, 50) || s.id.slice(0, 8)}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 truncate text-[10px] text-text-faint">
                              {s.timestamp && <span>{new Date(s.timestamp).toLocaleDateString()}</span>}
                              {isActive && (
                                <span className="flex items-center gap-0.5 font-medium text-accent">
                                  <span className="h-1 w-1 rounded-full bg-accent" />
                                  current
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-2 flex shrink-0 items-center gap-1">
                            {isFav && (
                              <StarIcon size={12} filled className="text-accent" />
                            )}
                            {s.messageCount != null && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                isActive ? "bg-accent/20 text-accent" : "bg-bg-active text-text-faint"
                              }`}>
                                {s.messageCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <FilePathMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={[
            {
              label: isFavorite(contextMenu.session.cwd || "")
                ? "Remove from Favorites"
                : "Add to Favorites",
              onSelect: () => {
                toggleFavorite(contextMenu.session.cwd || "");
              },
            },
            {
              label: "Delete Session",
              onSelect: async () => {
                const s = contextMenu.session;
                try {
                  const result = await window.pi.api.deleteSession({ file: s.file });
                  if (result.success) {
                    refresh();
                  }
                } catch (err) {
                  console.error("[sessions] Failed to delete:", err);
                }
              },
            },
            // Only offered for sessions living in a managed worktree; the main
            // process re-verifies it's a linked worktree before removing.
            ...(isManagedWorktreePath(contextMenu.session.cwd)
              ? [
                  {
                    label: "Remove Worktree…",
                    onSelect: () => handleRemoveWorktree(contextMenu.session.cwd!),
                  },
                ]
              : []),
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* New-worktree branch prompt (window.prompt doesn't exist in Electron) */}
      {worktreeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !worktreeBusy && setWorktreeModal(null)}
        >
          <div
            className="w-[380px] max-w-[90vw] rounded-xl border border-border bg-bg-active p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-text">
              <BranchIcon size={13} />
              New worktree session
            </div>
            <p className="mb-3 text-[11px] text-text-muted">
              Creates an isolated checkout of{" "}
              <span className="font-mono text-text">
                {worktreeModal.repoPath.split("/").pop() || worktreeModal.repoPath}
              </span>{" "}
              on a new branch, so this session can work in parallel without touching the main
              folder.
            </p>
            <input
              autoFocus
              value={branchInput}
              onChange={(e) => setBranchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createWorktree();
                if (e.key === "Escape" && !worktreeBusy) setWorktreeModal(null);
              }}
              placeholder="new branch name (e.g. feature/login)"
              disabled={worktreeBusy}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text focus:border-accent/50 focus:outline-none"
            />
            {worktreeError && (
              <p className="mt-2 text-[11px] text-danger">{worktreeError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setWorktreeModal(null)}
                disabled={worktreeBusy}
                className="rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-[11px] text-text-muted hover:bg-bg-active disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createWorktree}
                disabled={worktreeBusy || !branchInput.trim()}
                className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {worktreeBusy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StarIcon({ size = 14, filled, className }: { size?: number; filled?: boolean; className?: string }) {
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
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
