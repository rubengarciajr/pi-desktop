import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  worktreePathFor,
  parseWorktreePorcelain,
  isValidBranchName,
  isLinkedWorktree,
  addWorktree,
  removeWorktree,
  listWorktrees,
  getMainRepoRoot,
} from "./git";

/** True when a git binary is available (integration tests need one). */
const hasGit = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("worktreePathFor", () => {
  it("is deterministic and lives under ~/.pi/worktrees", () => {
    const a = worktreePathFor("/Users/x/code/my-repo", "feature/login");
    const b = worktreePathFor("/Users/x/code/my-repo", "feature/login");
    expect(a).toBe(b);
    expect(a).toContain(path.join(".pi", "worktrees"));
  });

  it("keeps two repos with the same basename apart", () => {
    const a = worktreePathFor("/Users/x/code/app", "fix");
    const b = worktreePathFor("/Users/x/other/app", "fix");
    expect(a).not.toBe(b);
  });

  it("sanitizes branch and repo names for the filesystem", () => {
    const p = worktreePathFor("/Users/x/my repo!", "feature/log in");
    const segments = p.split(path.sep);
    const leaf = segments[segments.length - 1];
    const repoDir = segments[segments.length - 2];
    expect(leaf).toBe("feature_log_in");
    expect(repoDir.startsWith("my_repo_")).toBe(true);
  });
});

describe("parseWorktreePorcelain", () => {
  const repoRoot = "/Users/x/code/app";
  const sample = [
    `worktree ${repoRoot}`,
    "HEAD 1234567890abcdef1234567890abcdef12345678",
    "branch refs/heads/main",
    "",
    "worktree /Users/x/.pi/worktrees/app-abc12345/feature-x",
    "HEAD abcdef1234567890abcdef1234567890abcdef12",
    "branch refs/heads/feature-x",
    "",
    "worktree /Users/x/.pi/worktrees/app-abc12345/detached-one",
    "HEAD abcdef1234567890abcdef1234567890abcdef12",
    "detached",
  ].join("\n");

  it("lists linked worktrees and excludes the primary checkout", () => {
    const result = parseWorktreePorcelain(sample, repoRoot);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      path: "/Users/x/.pi/worktrees/app-abc12345/feature-x",
      branch: "feature-x",
      repoPath: repoRoot,
      repoName: "app",
    });
    expect(result[1].branch).toBe("(detached)");
  });

  it("returns [] for empty output", () => {
    expect(parseWorktreePorcelain("", repoRoot)).toEqual([]);
  });
});

describe.runIf(hasGit)("isValidBranchName", () => {
  it("accepts normal branch names", async () => {
    expect(await isValidBranchName("feature/login")).toBe(true);
    expect(await isValidBranchName("fix-123")).toBe(true);
  });

  it("rejects malformed or dangerous names", async () => {
    expect(await isValidBranchName("")).toBe(false);
    expect(await isValidBranchName("-starts-with-dash")).toBe(false);
    expect(await isValidBranchName("has space")).toBe(false);
    expect(await isValidBranchName("a..b")).toBe(false);
    expect(await isValidBranchName("bad~name")).toBe(false);
  });
});

describe.runIf(hasGit)("worktree lifecycle (integration)", () => {
  let tmp: string;
  let repo: string;
  let wtPath: string;

  const git = (args: string[], cwd: string) =>
    execFileSync("git", args, { cwd, encoding: "utf-8" });

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-worktree-test-"));
    repo = path.join(tmp, "repo");
    wtPath = path.join(tmp, "wt", "feature-x");
    fs.mkdirSync(repo, { recursive: true });
    git(["init", "-b", "main"], repo);
    fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
    git(["add", "."], repo);
    git(
      ["-c", "user.email=test@test", "-c", "user.name=test", "-c", "commit.gpgsign=false", "commit", "-m", "init"],
      repo,
    );
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("refuses a repo with no commits", async () => {
    const empty = path.join(tmp, "empty");
    fs.mkdirSync(empty, { recursive: true });
    git(["init", "-b", "main"], empty);
    const res = await addWorktree(empty, "x", { worktreePath: path.join(tmp, "never") });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no commits/i);
  });

  it("creates a worktree on a new branch", async () => {
    const res = await addWorktree(repo, "feature-x", { worktreePath: wtPath });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.info.branch).toBe("feature-x");
      expect(fs.existsSync(path.join(wtPath, "README.md"))).toBe(true);
      // Linked worktrees have a `.git` FILE (gitdir pointer), not a directory.
      expect(await isLinkedWorktree(wtPath)).toBe(true);
      expect(await isLinkedWorktree(repo)).toBe(false);
    }
  });

  it("resolves the main repo root from inside the worktree", async () => {
    expect(await getMainRepoRoot(wtPath)).toBe(fs.realpathSync(repo));
  });

  it("lists the worktree from either checkout", async () => {
    const fromRepo = await listWorktrees(repo);
    const fromWt = await listWorktrees(wtPath);
    expect(fromRepo.map((w) => w.branch)).toContain("feature-x");
    expect(fromWt.map((w) => w.branch)).toContain("feature-x");
  });

  it("rejects a duplicate branch name", async () => {
    const res = await addWorktree(repo, "feature-x", { worktreePath: path.join(tmp, "dup") });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already exists/i);
  });

  it("refuses to remove a dirty worktree, then removes with force", async () => {
    fs.writeFileSync(path.join(wtPath, "uncommitted.txt"), "wip\n");
    const refused = await removeWorktree(wtPath);
    expect(refused.ok).toBe(false);
    expect(refused.error).toBe("DIRTY_WORKTREE");

    const forced = await removeWorktree(wtPath, true);
    expect(forced.ok).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);
    expect((await listWorktrees(repo)).map((w) => w.branch)).not.toContain("feature-x");
  });

  it("refuses to remove a path that is not a linked worktree", async () => {
    const res = await removeWorktree(repo);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not a linked git worktree/i);
  });
}, 30000);
