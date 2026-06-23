import { useState, useEffect } from "react";
import type { GitRepoInfo } from "../../../shared/ipc";
import { useAppStore } from "../store/useAppStore";

/**
 * A tiny glowing dot shown in a tab after the folder icon when the repo has
 * pending changes (uncommitted/untracked, or commits to push/pull). Clears
 * itself once everything is committed & synced. Polls cheaply and refreshes the
 * moment the agent finishes a turn (when it's most likely to have edited files).
 */
export function GitDirtyDot({ cwd, tabId }: { cwd?: string; tabId?: string }) {
  const [info, setInfo] = useState<GitRepoInfo | null>(null);
  const isStreaming = useAppStore((s) => s.activeTab.piState.isStreaming);

  useEffect(() => {
    if (!cwd) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    const load = () =>
      window.pi.api.getGitInfo({ tabId }).then((d) => { if (!cancelled) setInfo(d); }).catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [cwd, tabId]);

  // Refresh as soon as a turn ends — the agent likely just changed files.
  useEffect(() => {
    if (isStreaming || !cwd) return;
    window.pi.api.getGitInfo({ tabId }).then(setInfo).catch(() => {});
  }, [isStreaming, cwd, tabId]);

  if (!info || !info.isRepo) return null;
  const pending =
    (info.unstagedCount || 0) + (info.stagedCount || 0) + (info.untrackedCount || 0) +
    (info.ahead || 0) + (info.behind || 0);
  if (pending === 0) return null;

  return (
    <span
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning animate-glow"
      title={`${pending} pending change${pending !== 1 ? "s" : ""} — commit & sync`}
    />
  );
}

export function GitRepoBadge({ cwd, tabId }: { cwd?: string; tabId?: string }) {
  const [info, setInfo] = useState<GitRepoInfo | null>(null);

  useEffect(() => {
    if (!cwd) return;
    let cancelled = false;
    window.pi.api.getGitInfo({ tabId }).then((data) => {
      if (!cancelled) setInfo(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [cwd, tabId]);

  if (!info || !info.isRepo) return null;

  const dirtyCount = (info.unstagedCount || 0) + (info.stagedCount || 0) + (info.untrackedCount || 0);

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-text-faint">
      {/* Branch indicator */}
      <div className="flex items-center gap-1">
        <BranchIcon size={11} />
        <span className="font-mono">{info.branch || "detached"}</span>
      </div>

      {/* Dirty indicator */}
      {dirtyCount > 0 && (
        <span className="rounded-full bg-warning/20 px-1.5 py-0.5 text-[9px] text-warning">
          {dirtyCount} change{dirtyCount !== 1 ? "s" : ""}
        </span>
      )}

      {/* Ahead/behind */}
      {(info.ahead || info.behind) ? (
        <span className="flex items-center gap-1">
          {info.ahead ? <span className="text-accent">↑{info.ahead}</span> : null}
          {info.behind ? <span className="text-text-faint">↓{info.behind}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function GitRepoHeader({ cwd, tabId }: { cwd?: string; tabId?: string }) {
  const [info, setInfo] = useState<GitRepoInfo | null>(null);

  useEffect(() => {
    if (!cwd) return;
    let cancelled = false;
    window.pi.api.getGitInfo({ tabId }).then((data) => {
      if (!cancelled) setInfo(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [cwd, tabId]);

  if (!info || !info.isRepo) {
    // Show a "not a git repo" hint only when cwd is set
    if (cwd) return <span className="text-[10px] text-text-faint">no git repo</span>;
    return null;
  }

  const dirtyCount = (info.unstagedCount || 0) + (info.stagedCount || 0) + (info.untrackedCount || 0);
  const repoLabel = info.repoOwner ? `${info.repoOwner}/${info.repoName}` : info.repoName || info.remoteUrl;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-faint">
      {/* GitHub link */}
      {info.repoOwner && (
        <a
          href={`https://github.com/${info.repoOwner}/${info.repoName}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-text-muted transition-colors hover:text-accent"
          title={info.remoteUrl}
        >
          <GithubIcon size={11} />
          <span className="font-mono">{repoLabel}</span>
        </a>
      )}

      {/* Branch */}
      <div className="flex items-center gap-1">
        <BranchIcon size={10} />
        <span className="font-mono">{info.branch || "detached"}</span>
      </div>

      {/* Dirty */}
      {dirtyCount > 0 && (
        <span className="flex items-center gap-0.5">
          <span className="text-warning">●</span>
          {info.untrackedCount ? `+${info.untrackedCount}` : `${dirtyCount}`}
        </span>
      )}

      {/* Ahead/behind */}
      {(info.ahead || info.behind) ? (
        <span className="flex items-center gap-1">
          {info.ahead ? <span className="text-accent">↑{info.ahead}</span> : null}
          {info.behind ? <span className="text-text-faint">↓{info.behind}</span> : null}
        </span>
      ) : null}

      {/* Last commit */}
      {info.lastCommitMessage && (
        <span className="max-w-[200px] truncate italic">
          {info.lastCommitMessage}
        </span>
      )}
    </div>
  );
}

function BranchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function GithubIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
