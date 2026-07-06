import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "fs";
import * as path from "path";

const pExecFile = promisify(execFile);

export interface GitRepoInfo {
  isRepo: boolean;
  remoteUrl?: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  ahead?: number;
  behind?: number;
  dirty?: boolean;
  stagedCount?: number;
  unstagedCount?: number;
  untrackedCount?: number;
  lastCommitMessage?: string;
  lastCommitHash?: string;
  lastCommitDate?: string;
  lastCommitAuthor?: string;
  totalCommits?: number;
}

/**
 * Run a git command asynchronously. Returns trimmed stdout or `null` on
 * failure/timeout. Never blocks the main thread (the previous execFileSync
 * implementation froze the UI for the full 5s timeout on every poll).
 */
async function run(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await pExecFile("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  // SSH: git@github.com:owner/repo.git
  const ssh = url.match(/git@github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  // HTTPS: https://github.com/owner/repo.git
  const https = url.match(/https?:\/\/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (https) return { owner: https[1], repo: https[2] };
  return null;
}

/**
 * Short-lived per-cwd cache so the two concurrent 5s polls (GitDirtyDot +
 * GitHubBadge) for the same working directory share one subprocess batch
 * instead of each firing ~7 git spawns.
 */
interface CacheEntry {
  value: GitRepoInfo;
  expires: number;
}
const CACHE_TTL_MS = 3000;
const gitInfoCache = new Map<string, CacheEntry>();

/** Cached async variant — reads from the in-memory cache when fresh. */
export async function getGitInfoCached(cwd: string): Promise<GitRepoInfo> {
  const hit = gitInfoCache.get(cwd);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;
  const value = await getGitInfo(cwd);
  gitInfoCache.set(cwd, { value, expires: now + CACHE_TTL_MS });
  return value;
}

export async function getGitInfo(cwd: string): Promise<GitRepoInfo> {
  const info: GitRepoInfo = { isRepo: false };

  // Check if it's a git repo
  const gitDir = path.join(cwd, ".git");
  if (!fs.existsSync(gitDir)) {
    const isRepo = await run(["rev-parse", "--is-inside-work-tree"], cwd);
    if (!isRepo) return info;
  }

  info.isRepo = true;

  // Remote URL
  const remoteUrl = await run(["remote", "get-url", "origin"], cwd);
  if (remoteUrl) {
    info.remoteUrl = remoteUrl;
    const parsed = parseGithubUrl(remoteUrl);
    if (parsed) {
      info.repoOwner = parsed.owner;
      info.repoName = parsed.repo;
    }
  }

  // Branch
  info.branch = (await run(["rev-parse", "--abbrev-ref", "HEAD"], cwd)) || undefined;

  // Ahead/behind
  const tracking = await run(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], cwd);
  if (tracking) {
    const [ahead, behind] = tracking.split(/\s+/).map(Number);
    info.ahead = ahead;
    info.behind = behind;
  }

  // Status
  const porcelain = await run(["status", "--porcelain"], cwd);
  if (porcelain) {
    const lines = porcelain.split("\n").filter(Boolean);
    info.stagedCount = lines.filter((l) => l[0] !== " " && l[0] !== "?").length;
    info.unstagedCount = lines.filter((l) => l[1] !== " " && l[1] !== "?").length;
    info.untrackedCount = lines.filter((l) => l[0] === "?").length;
    info.dirty = true;
  } else {
    info.stagedCount = 0;
    info.unstagedCount = 0;
    info.untrackedCount = 0;
    info.dirty = false;
  }

  // Last commit
  const lastCommit = await run(["log", "-1", "--format=%H|%s|%an|%ar|%ad"], cwd);
  if (lastCommit) {
    const [hash, message, author, dateRelative, dateISO] = lastCommit.split("|");
    info.lastCommitHash = hash;
    info.lastCommitMessage = message;
    info.lastCommitAuthor = author;
    info.lastCommitDate = dateRelative || dateISO;
  }

  // Total commits
  const count = await run(["rev-list", "--count", "HEAD"], cwd);
  if (count) info.totalCommits = parseInt(count, 10);

  return info;
}
