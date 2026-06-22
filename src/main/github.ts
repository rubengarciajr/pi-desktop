import { execFileSync } from "child_process";
import { safeStorage, app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";

const TOKEN_FILE = join(app.getPath("userData"), "github-token.enc");

export interface GitHubAuthState {
  authenticated: boolean;
  username?: string;
  avatarUrl?: string;
  error?: string;
}

export interface GitHubSyncState {
  ahead: number;
  behind: number;
  hasRemote: boolean;
  repoName?: string;
  repoOwner?: string;
  branch?: string;
  lastSync?: number;
}

/** Securely store GitHub token using Electron safeStorage. */
export function storeGitHubToken(token: string): void {
  try {
    const encrypted = safeStorage.encryptString(token);
    writeFileSync(TOKEN_FILE, encrypted);
  } catch (err) {
    console.error("[github] Failed to store token:", err);
  }
}

/** Retrieve stored token. */
export function getGitHubToken(): string | null {
  try {
    if (!existsSync(TOKEN_FILE)) return null;
    const encrypted = readFileSync(TOKEN_FILE);
    if (encrypted.length === 0) return null;
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

/** Clear stored token. */
export function clearGitHubToken(): void {
  try {
    if (existsSync(TOKEN_FILE)) {
      unlinkSync(TOKEN_FILE);
    }
  } catch {}
}

/** Verify a PAT and return user info. */
export async function verifyToken(token: string): Promise<GitHubAuthState> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    return { authenticated: false, error: `Invalid token (${res.status})` };
  }

  const data: any = await res.json();
  return {
    authenticated: true,
    username: data.login,
    avatarUrl: data.avatar_url,
  };
}

/** Get auth status from stored token. */
export async function getGitHubAuthStatus(): Promise<GitHubAuthState> {
  const token = getGitHubToken();
  if (!token) return { authenticated: false };
  return verifyToken(token);
}

/** Get sync state for a working directory, including linkage file. */
export function getSyncState(cwd: string): GitHubSyncState {
  const state: GitHubSyncState = { ahead: 0, behind: 0, hasRemote: false };

  // First check if there's a git remote.
  const remoteUrl = tryExecFile("git", ["remote", "get-url", "origin"], cwd);
  if (!remoteUrl) {
    // No git remote, but check the linkage file (e.g., on a fresh clone machine).
    const linkage = readRepoLinkage(cwd);
    if (linkage) {
      state.hasRemote = false; // no actual remote yet
      state.repoOwner = linkage.repoOwner;
      state.repoName = linkage.repoName;
    }
    return state;
  }
  state.hasRemote = true;

  const ssh = remoteUrl.match(/git@github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  const https = remoteUrl.match(/https?:\/\/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  const match = ssh || https;
  if (match) {
    state.repoOwner = match[1];
    state.repoName = match[2];
  }

  state.branch = tryExecFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd) || "main";

  // Fetch quietly to update ahead/behind.
  tryExecFile("git", ["fetch", "--quiet"], cwd);

  const tracking = tryExecFile("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], cwd);
  if (tracking) {
    const parts = tracking.split(/\s+/);
    state.ahead = parseInt(parts[0], 10) || 0;
    state.behind = parseInt(parts[1], 10) || 0;
  }

  return state;
}

/** Push local changes to remote. Uses git credential helper. */
export function pushToRemote(cwd: string): { success: boolean; error?: string } {
  try {
    execFileSync("git", ["push"], { cwd, encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Push failed" };
  }
}

/** Pull from remote. */
export function pullFromRemote(cwd: string): { success: boolean; error?: string } {
  try {
    execFileSync("git", ["pull"], { cwd, encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Pull failed" };
  }
}

// --- Per-folder repo linkage -------------------------------------------

export interface RepoLinkage {
  repoOwner: string;
  repoName: string;
  remoteUrl: string;
  linkedAt: string;
}

const LINKAGE_FILE = ".pi-desktop/github.json";

/** Read the per-folder repo linkage file. */
export function readRepoLinkage(cwd: string): RepoLinkage | null {
  try {
    const content = readFileSync(join(cwd, LINKAGE_FILE), "utf-8");
    return JSON.parse(content) as RepoLinkage;
  } catch {
    return null;
  }
}

/** Write the per-folder repo linkage file. */
export function writeRepoLinkage(cwd: string, linkage: RepoLinkage): void {
  const dir = join(cwd, ".pi-desktop");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "github.json"), JSON.stringify(linkage, null, 2));
}

/** List user's GitHub repos for the "attach" picker. */
export async function listUserRepos(token: string): Promise<{ name: string; fullName: string; private: boolean; url: string }[]> {
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return [];
  const data: any = await res.json();
  return data.map((r: any) => ({
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    url: r.clone_url,
  }));
}

/** Attach an existing GitHub repo to the local folder: set remote, write linkage. */
export function attachRepo(cwd: string, repo: { owner: string; name: string; remoteUrl: string }): { success: boolean; error?: string } {
  try {
    tryExecFile("git", ["init"], cwd);
    tryExecFile("git", ["remote", "remove", "origin"], cwd);
    execFileSync("git", ["remote", "add", "origin", repo.remoteUrl], { cwd, encoding: "utf-8", timeout: 5000 });
    tryExecFile("git", ["fetch", "--quiet"], cwd);
    writeRepoLinkage(cwd, {
      repoOwner: repo.owner,
      repoName: repo.name,
      remoteUrl: repo.remoteUrl,
      linkedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to attach repo" };
  }
}

/** Clone a repo into a local folder (for new machine / new folder setup). */
export function cloneRepo(remoteUrl: string, localPath: string): { success: boolean; error?: string } {
  try {
    execFileSync("git", ["clone", remoteUrl, localPath], { encoding: "utf-8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to clone" };
  }
}

/** Create a new GitHub repo via API and link it to the local folder. */
export async function createRepo(
  cwd: string,
  token: string,
  options: { name: string; private: boolean; description?: string },
): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  const dirName = cwd.split("/").pop() || "new-repo";

  // Create repo on GitHub.
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: options.name || dirName,
      private: options.private,
      description: options.description || "",
      auto_init: false,
    }),
  });

  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    return { success: false, error: data.message || `GitHub API error (${res.status})` };
  }

  const data: any = await res.json();
  const sshUrl = data.ssh_url;
  const httpsUrl = data.clone_url;
  const repoUrl = sshUrl || httpsUrl;

  // Initialize git if needed.
  tryExecFile("git", ["init"], cwd);

  // Set remote (remove existing origin first if present).
  tryExecFile("git", ["remote", "remove", "origin"], cwd);
  execFileSync("git", ["remote", "add", "origin", repoUrl], { cwd, encoding: "utf-8", timeout: 5000 });

  // Initial commit + push if there are files.
  const hasFiles = tryExecFile("git", ["status", "--porcelain"], cwd);
  if (hasFiles) {
    execFileSync("git", ["add", "-A"], { cwd, encoding: "utf-8", timeout: 10000 });
    tryExecFile("git", ["commit", "-m", "Initial commit from Pi Desktop"], cwd);
  }

  // Push to set upstream.
  const branch = tryExecFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd) || "main";
  try {
    execFileSync("git", ["push", "-u", "origin", branch], { cwd, encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
  } catch (err: any) {
    // Push may fail if no files/commits, but repo was still created.
  }

  // Write linkage so this folder remembers its repo.
  writeRepoLinkage(cwd, {
    repoOwner: data.owner?.login || options.name,
    repoName: options.name || dirName,
    remoteUrl: repoUrl,
    linkedAt: new Date().toISOString(),
  });

  return { success: true, repoUrl };
}

/** Safe exec helper using arg arrays (no shell injection risk). */
function tryExecFile(cmd: string, args: string[], cwd: string): string | null {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}
