import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

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

function run(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim();
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

export function getGitInfo(cwd: string): GitRepoInfo {
  const info: GitRepoInfo = { isRepo: false };

  // Check if it's a git repo
  const gitDir = path.join(cwd, ".git");
  if (!fs.existsSync(gitDir)) {
    const isRepo = run("git rev-parse --is-inside-work-tree", cwd);
    if (!isRepo) return info;
  }

  info.isRepo = true;

  // Remote URL
  const remoteUrl = run("git remote get-url origin", cwd);
  if (remoteUrl) {
    info.remoteUrl = remoteUrl;
    const parsed = parseGithubUrl(remoteUrl);
    if (parsed) {
      info.repoOwner = parsed.owner;
      info.repoName = parsed.repo;
    }
  }

  // Branch
  info.branch = run("git rev-parse --abbrev-ref HEAD", cwd) || undefined;

  // Ahead/behind
  const tracking = run("git rev-list --left-right --count HEAD...@{upstream}", cwd);
  if (tracking) {
    const [ahead, behind] = tracking.split(/\s+/).map(Number);
    info.ahead = ahead;
    info.behind = behind;
  }

  // Status
  const porcelain = run("git status --porcelain", cwd);
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
  const lastCommit = run('git log -1 --format="%H|%s|%an|%ar|%ad"', cwd);
  if (lastCommit) {
    const [hash, message, author, dateRelative, dateISO] = lastCommit.split("|");
    info.lastCommitHash = hash;
    info.lastCommitMessage = message;
    info.lastCommitAuthor = author;
    info.lastCommitDate = dateRelative || dateISO;
  }

  // Total commits
  const count = run("git rev-list --count HEAD", cwd);
  if (count) info.totalCommits = parseInt(count, 10);

  return info;
}
