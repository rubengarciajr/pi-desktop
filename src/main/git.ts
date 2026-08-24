import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import * as fs from "fs";
import * as path from "path";

const pExecFile = promisify(execFile);

export interface GitRepoInfo {
  isRepo: boolean;
  /** True when cwd is a *linked* git worktree (not the primary checkout). */
  isWorktree?: boolean;
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

/**
 * Like `run`, but preserves git's stderr so callers can surface a real error
 * message instead of a generic "git failed". Used by the worktree operations,
 * which are user-initiated (a swallowed error there means a confusing UI).
 */
async function runVerbose(
  args: string[],
  cwd: string,
  timeout = 15000,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await pExecFile("git", args, {
      cwd,
      encoding: "utf-8",
      timeout,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: any) {
    const stderr =
      (typeof err?.stderr === "string" && err.stderr.trim()) ||
      err?.message ||
      String(err);
    return { ok: false, stdout: (err?.stdout ?? "").toString().trim(), stderr };
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
  info.isWorktree = await isLinkedWorktree(cwd);

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

// --- Git worktrees -----------------------------------------------------------
// Worktree sessions: each agent session can run in an isolated `git worktree`
// (a separate checkout on its own branch) so parallel sessions on the same repo
// never collide. All management goes through `git worktree` — never raw fs
// deletion — so git's linked-worktree metadata stays consistent.

/** Where managed worktrees live: ~/.pi/worktrees/<repo>-<hash>/<branch>. */
const WORKTREES_ROOT = () => path.join(homedir(), ".pi", "worktrees");

export interface WorktreeInfo {
  /** Absolute path of the worktree checkout. */
  path: string;
  /** Branch checked out in the worktree ("(detached)" if none). */
  branch: string;
  /** Root of the repository this worktree belongs to. */
  repoPath: string;
  repoName: string;
}

/**
 * True only for a *linked* worktree. In a linked worktree `.git` is a FILE
 * (a "gitdir: …" pointer); in the primary checkout it is a directory.
 */
export async function isLinkedWorktree(cwd: string): Promise<boolean> {
  try {
    const st = await fs.promises.stat(path.join(cwd, ".git"));
    return st.isFile();
  } catch {
    return false;
  }
}

/** Validate a proposed branch name via git's own ref rules. */
export async function isValidBranchName(name: string): Promise<boolean> {
  // Pre-reject anything git's CLI could mis-parse as an option flag.
  if (!name || name.length > 200 || name.startsWith("-")) return false;
  const ok = await run(["check-ref-format", "--branch", name], homedir());
  return ok !== null;
}

/** Resolve the repository root containing `cwd` (null if not a repo). */
export async function getRepoRoot(cwd: string): Promise<string | null> {
  return await run(["rev-parse", "--show-toplevel"], cwd);
}

/**
 * Resolve the MAIN repository root even when `cwd` is inside a linked
 * worktree (where --show-toplevel returns the worktree root instead).
 * Needed because `git worktree remove` can't run from inside the worktree
 * being removed.
 */
export async function getMainRepoRoot(cwd: string): Promise<string | null> {
  const commonDir = await run(
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    cwd,
  );
  if (!commonDir) return null;
  // commonDir is the main checkout's .git directory.
  return path.basename(commonDir) === ".git" ? path.dirname(commonDir) : commonDir;
}

/**
 * Compute a stable, collision-resistant worktree location, e.g.
 * ~/.pi/worktrees/pi-desktop-3f9a1c22/feature-x. The 8-char hash of the
 * absolute repo path keeps two repos with the same basename apart.
 */
export function worktreePathFor(repoRoot: string, branch: string): string {
  const repoBase = path.basename(repoRoot).replace(/[^\w.-]/g, "_");
  const hash = createHash("sha1").update(repoRoot).digest("hex").slice(0, 8);
  const safeBranch = branch.replace(/[^\w.-]/g, "_");
  return path.join(WORKTREES_ROOT(), `${repoBase}-${hash}`, safeBranch);
}

export type WorktreeResult =
  | { ok: true; info: WorktreeInfo }
  | { ok: false; error: string };

/**
 * Create a NEW branch + worktree. Fails cleanly (with git's real error) if the
 * branch exists, the repo has no commits, or the path is taken.
 * `opts.worktreePath` overrides the default location (used by tests).
 */
export async function addWorktree(
  repoRoot: string,
  branch: string,
  opts?: { baseRef?: string; worktreePath?: string },
): Promise<WorktreeResult> {
  if (!(await isValidBranchName(branch))) {
    return { ok: false, error: `"${branch}" is not a valid git branch name.` };
  }
  // Unborn HEAD (fresh `git init`) — `worktree add` would fail confusingly.
  const head = await run(["rev-parse", "--verify", "--quiet", "HEAD"], repoRoot);
  if (head === null) {
    return { ok: false, error: "This repository has no commits yet — make an initial commit first." };
  }
  // MVP keeps it simple: only brand-new branches.
  const exists = await run(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], repoRoot);
  if (exists !== null) {
    return { ok: false, error: `Branch "${branch}" already exists. Pick a new name.` };
  }
  const wtPath = opts?.worktreePath ?? worktreePathFor(repoRoot, branch);
  if (fs.existsSync(wtPath)) {
    return { ok: false, error: `Worktree folder already exists: ${wtPath}` };
  }
  await fs.promises.mkdir(path.dirname(wtPath), { recursive: true });
  const args = ["worktree", "add", "-b", branch, wtPath];
  if (opts?.baseRef) args.push(opts.baseRef);
  // Large repos check out the whole tree here — allow well beyond the 5s poll timeout.
  const res = await runVerbose(args, repoRoot, 60000);
  if (!res.ok) {
    return { ok: false, error: res.stderr || "git worktree add failed." };
  }
  return {
    ok: true,
    info: { path: wtPath, branch, repoPath: repoRoot, repoName: path.basename(repoRoot) },
  };
}

/**
 * Remove a linked worktree via `git worktree remove` (never raw deletion).
 * Refuses non-worktree paths (protects the primary checkout), and refuses a
 * dirty worktree unless `force` — so uncommitted work is never silently lost.
 */
export async function removeWorktree(
  worktreePath: string,
  force = false,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isLinkedWorktree(worktreePath))) {
    return { ok: false, error: "Not a linked git worktree — refusing to remove." };
  }
  const mainRoot = await getMainRepoRoot(worktreePath);
  if (!mainRoot) {
    return { ok: false, error: "Could not resolve the worktree's main repository." };
  }
  const args = ["worktree", "remove", ...(force ? ["--force"] : []), worktreePath];
  const res = await runVerbose(args, mainRoot, 30000);
  if (!res.ok) {
    const dirty = /contains modified or untracked files|is dirty/i.test(res.stderr);
    return {
      ok: false,
      error: dirty
        ? "DIRTY_WORKTREE"
        : res.stderr || "git worktree remove failed.",
    };
  }
  return { ok: true };
}

/** Parse `git worktree list --porcelain` output (exported for tests). */
export function parseWorktreePorcelain(out: string, repoRoot: string): WorktreeInfo[] {
  const blocks = out.split(/\n\n+/).filter(Boolean);
  const result: WorktreeInfo[] = [];
  for (const b of blocks) {
    const wt = b.match(/^worktree (.+)$/m)?.[1];
    const br = b.match(/^branch refs\/heads\/(.+)$/m)?.[1];
    if (wt && path.resolve(wt) !== path.resolve(repoRoot)) {
      result.push({
        path: wt,
        branch: br ?? "(detached)",
        repoPath: repoRoot,
        repoName: path.basename(repoRoot),
      });
    }
  }
  return result;
}

/** List linked worktrees for the repo containing `cwd`. */
export async function listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  const repoRoot = await getMainRepoRoot(cwd);
  if (!repoRoot) return [];
  const out = await run(["worktree", "list", "--porcelain"], repoRoot);
  if (!out) return [];
  return parseWorktreePorcelain(out, repoRoot);
}
