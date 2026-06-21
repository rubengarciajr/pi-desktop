import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

interface AuthState {
  authenticated: boolean;
  username?: string;
  avatarUrl?: string;
  error?: string;
}

interface SyncState {
  ahead: number;
  behind: number;
  hasRemote: boolean;
  repoName?: string;
  repoOwner?: string;
  branch?: string;
}

interface RepoListItem {
  name: string;
  fullName: string;
  private: boolean;
  url: string;
}

type MenuView = "main" | "create" | "attach" | "sync";

export function GitHubBadge() {
  const [auth, setAuth] = useState<AuthState>({ authenticated: false });
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>("main");
  const [syncing, setSyncing] = useState(false);

  // Create repo form
  const [repoName, setRepoName] = useState("");
  const [repoPrivate, setRepoPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Attach repo
  const [repoList, setRepoList] = useState<RepoListItem[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const cwd = useAppStore((s) => s.activeTab.piState.cwd);

  useEffect(() => {
    window.pi.github.getAuthStatus().then((s: AuthState) => setAuth(s)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!cwd) {
      setSyncState(null);
      return;
    }
    let cancelled = false;
    window.pi.github.getSyncState({ tabId: activeTabId ?? undefined }).then((s: SyncState) => {
      if (!cancelled) setSyncState(s);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [cwd, activeTabId]);

  useEffect(() => {
    if (!showMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setMenuView("main");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showMenu]);

  // Show when authenticated and inside a session.
  if (!cwd || !auth.authenticated) return null;

  const hasRepo = syncState?.hasRemote;
  const totalChanges = (syncState?.ahead ?? 0) + (syncState?.behind ?? 0);
  const iconColor = hasRepo ? "#a855f7" : "#666666";

  const refreshSyncState = async () => {
    const s: SyncState = await window.pi.github.getSyncState({ tabId: activeTabId ?? undefined });
    setSyncState(s);
  };

  const handlePush = async () => {
    setSyncing(true);
    await window.pi.github.push({ tabId: activeTabId ?? undefined });
    setSyncing(false);
    await refreshSyncState();
  };

  const handlePull = async () => {
    setSyncing(true);
    await window.pi.github.pull({ tabId: activeTabId ?? undefined });
    setSyncing(false);
    await refreshSyncState();
  };

  const handleCreateRepo = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res: any = await window.pi.github.createRepo({
        name: repoName.trim() || undefined,
        private: repoPrivate,
        tabId: activeTabId ?? undefined,
      });
      if (res.success) {
        setShowMenu(false);
        setMenuView("main");
        await refreshSyncState();
      } else {
        setCreateError(res.error || "Failed to create repo");
      }
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create repo");
    }
    setCreating(false);
  };

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const repos = await window.pi.github.listRepos();
      setRepoList(repos);
    } catch {}
    setLoadingRepos(false);
  };

  const handleAttach = async (repo: RepoListItem) => {
    setAttaching(true);
    setAttachError(null);
    const [owner] = repo.fullName.split("/");
    const res: any = await window.pi.github.attachRepo({
      owner,
      name: repo.name,
      remoteUrl: repo.url,
      tabId: activeTabId ?? undefined,
    });
    if (res.success) {
      setShowMenu(false);
      setMenuView("main");
      await refreshSyncState();
    } else {
      setAttachError(res.error || "Failed to attach");
    }
    setAttaching(false);
  };

  const filteredRepos = repoList.filter((r) =>
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => { setShowMenu(!showMenu); setMenuView("main"); }}
        title={hasRepo ? `${syncState?.repoOwner}/${syncState?.repoName}` : "Link this folder to GitHub"}
        className="relative flex items-center justify-center rounded p-1 transition-colors hover:bg-bg-hover"
      >
        <GitHubIcon size={15} color={iconColor} />
        {totalChanges > 0 && hasRepo && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold text-white">
            {totalChanges}
          </span>
        )}
      </button>

      {showMenu && (
        <div className="absolute bottom-9 right-0 z-50 w-72 rounded-lg border border-border bg-bg-active py-1 shadow-2xl">
          {/* MAIN MENU */}
          {menuView === "main" && (
            <>
              {hasRepo ? (
                <>
                  <div className="border-b border-border px-3 py-1.5">
                    <div className="text-xs font-medium text-text">{syncState?.repoOwner}/{syncState?.repoName}</div>
                    <div className="text-[10px] text-text-faint font-mono">{syncState?.branch}</div>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-1.5 text-xs">
                    {syncState?.ahead ? <span className="text-accent">{syncState.ahead} to push</span> : null}
                    {syncState?.behind ? <span className="text-warning">{syncState.behind} to pull</span> : null}
                    {!syncState?.ahead && !syncState?.behind ? <span className="text-text-faint">Up to date</span> : null}
                  </div>
                  <button
                    onClick={handlePush}
                    disabled={syncing || !syncState?.ahead}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover disabled:opacity-40"
                  >
                    <ArrowUpIcon size={12} /> Push changes
                  </button>
                  <button
                    onClick={handlePull}
                    disabled={syncing || !syncState?.behind}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover disabled:opacity-40"
                  >
                    <ArrowDownIcon size={12} /> Pull latest
                  </button>
                </>
              ) : (
                <>
                  <div className="px-3 py-1.5">
                    <div className="text-xs font-medium text-text">{cwd.split("/").pop()}</div>
                    <div className="text-[10px] text-text-faint">Not linked to a repo</div>
                  </div>
                  <button
                    onClick={() => { setRepoName(cwd.split("/").pop() || ""); setMenuView("create"); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover"
                  >
                    <PlusIcon size={12} /> Create New Repo
                  </button>
                  <button
                    onClick={() => { setMenuView("attach"); loadRepos(); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover"
                  >
                    <LinkIcon size={12} /> Attach Existing Repo
                  </button>
                  <p className="px-3 py-1.5 text-[10px] text-text-faint">
                    Link this folder to sync across computers.
                  </p>
                </>
              )}
            </>
          )}

          {/* CREATE REPO */}
          {menuView === "create" && (
            <div className="p-3">
              <BackButton onClick={() => setMenuView("main")} label="Create New Repo" />
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder={cwd.split("/").pop() || "repo-name"}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text outline-none focus:border-accent"
                autoFocus
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                <input type="checkbox" checked={repoPrivate} onChange={(e) => setRepoPrivate(e.target.checked)} className="accent-accent" />
                Private
              </label>
              {createError && <p className="mt-1.5 text-[10px] text-danger">{createError}</p>}
              <button
                onClick={handleCreateRepo}
                disabled={creating}
                className="mt-2 w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create & Push"}
              </button>
            </div>
          )}

          {/* ATTACH REPO */}
          {menuView === "attach" && (
            <div>
              <div className="px-3 pb-2">
                <BackButton onClick={() => setMenuView("main")} label="Attach Existing Repo" />
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  placeholder="Search repos..."
                  className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
                  autoFocus
                />
              </div>
              {attachError && <p className="px-3 pb-1 text-[10px] text-danger">{attachError}</p>}
              {loadingRepos ? (
                <p className="px-3 py-2 text-xs text-text-faint">Loading repos...</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {filteredRepos.map((r) => (
                    <button
                      key={r.fullName}
                      onClick={() => handleAttach(r)}
                      disabled={attaching}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover disabled:opacity-40"
                    >
                      <span className="truncate font-mono">{r.fullName}</span>
                      {r.private && <span className="ml-2 text-[9px] text-warning">private</span>}
                    </button>
                  ))}
                  {filteredRepos.length === 0 && (
                    <p className="px-3 py-2 text-xs text-text-faint">No repos found</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mb-2 flex items-center gap-1 text-[10px] text-text-faint transition-colors hover:text-text-muted"
    >
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}

export function GitHubIcon({ size = 14, color = "currentColor", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={{ flexShrink: 0 }}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function ArrowUpIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
