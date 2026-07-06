import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { app } from "electron";

const pExecFile = promisify(execFile);

const CACHE_FILE = (() => {
  try {
    return join(app.getPath("userData"), "resolved-path.txt");
  } catch {
    return "";
  }
})();

/**
 * macOS (and Linux) GUI apps launched from Finder/Dock inherit a *minimal*
 * PATH — typically `/usr/bin:/bin:/usr/sbin:/sbin`. That omits every common
 * place where `node`, `npm`, and the `pi` CLI actually live (Homebrew, nvm,
 * Volta, the official Node installer, `~/.local/bin`, `~/.npm-global/bin`, …).
 *
 * As a result, `spawn("npm", …)` / `execSync("pi --version")` fail with
 * "command not found" even though the tools are installed in a terminal.
 *
 * This restores a realistic PATH by combining:
 *   1. a cached copy of the last resolved login-shell PATH (instant on relaunch),
 *   2. well-known install locations (cheap existsSync checks),
 *   3. the current process PATH (don't lose anything inherited),
 *   and then asynchronously refreshes #1 by probing the login shell, so the
 *   first launch after a profile change picks it up a moment later.
 *
 * The previous implementation ran the login-shell probe synchronously at
 * import time, blocking app startup for 500ms–2s before the window appeared.
 * Call this ONCE, as early as possible in the main process.
 */
export function fixPath(): void {
  // On Windows the GUI PATH is already complete; nothing to do.
  if (process.platform === "win32") return;

  const parts: string[] = [];
  const add = (value?: string) => {
    if (!value) return;
    for (const segment of value.split(delimiter)) {
      const seg = segment.trim();
      if (seg && !parts.includes(seg)) parts.push(seg);
    }
  };

  // 1. Cached login-shell PATH from a previous launch (instant; skips the probe).
  add(readCachedPath());

  // 2. Known-good fallbacks, so node/npm/pi resolve even without the probe.
  for (const dir of commonBinDirs()) {
    if (existsSync(dir)) add(dir);
  }

  // 3. Whatever PATH we already have (don't lose anything inherited).
  add(process.env.PATH);

  process.env.PATH = parts.join(delimiter);

  // 4. Asynchronously refresh the login-shell PATH and persist it for next time.
  void refreshLoginShellPath().catch(() => {
    /* probe failure is non-fatal — fallbacks above cover the common cases */
  });
}

/**
 * Resolve the full PATH and wait for the login-shell probe to finish. Use this
 * before spawning a child process that genuinely needs the shell PATH (e.g. the
 * installer) and can afford to await. `fixPath()` alone is enough for startup.
 */
export async function fixPathAsync(): Promise<void> {
  if (process.platform === "win32") return;
  await refreshLoginShellPath();
}

/** Read the cached resolved PATH from disk (written by a previous launch). */
function readCachedPath(): string {
  if (!CACHE_FILE) return "";
  try {
    return readFileSync(CACHE_FILE, "utf-8").trim();
  } catch {
    return "";
  }
}

/**
 * Ask the user's login shell what its PATH is, merge it into the live
 * `process.env.PATH`, and persist it so the next launch can read it
 * synchronously without spawning a shell. Uses an interactive login shell
 * (`-ilc`) so it sources the same profile files the user's terminal does.
 */
async function refreshLoginShellPath(): Promise<void> {
  const shellPath = await getLoginShellPath();
  if (!shellPath) return;

  // Merge the resolved shell PATH to the front of the live PATH.
  const parts: string[] = [];
  const add = (value?: string) => {
    if (!value) return;
    for (const segment of value.split(delimiter)) {
      const seg = segment.trim();
      if (seg && !parts.includes(seg)) parts.push(seg);
    }
  };
  add(shellPath);
  add(process.env.PATH);
  process.env.PATH = parts.join(delimiter);

  // Persist for next launch.
  if (CACHE_FILE) {
    try {
      mkdirSync(join(CACHE_FILE, ".."), { recursive: true });
      writeFileSync(CACHE_FILE, shellPath, "utf-8");
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * Ask the user's login shell what its PATH is. Uses an interactive login shell
 * (`-ilc`) so it sources the same profile files the user's terminal does
 * (`.zprofile`/`.zshrc`, `.bash_profile`/`.bashrc`, etc.). Markers bracket the
 * value so we can parse it cleanly even if the shell prints other noise.
 */
async function getLoginShellPath(): Promise<string> {
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    const { stdout } = await pExecFile(
      shell,
      ["-ilc", 'printf "__PI_PATH_START__%s__PI_PATH_END__" "$PATH"'],
      {
        encoding: "utf-8",
        timeout: 5000,
      },
    );
    const match = stdout.match(/__PI_PATH_START__(.*?)__PI_PATH_END__/s);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

/** Well-known directories where node/npm/pi and friends are commonly installed. */
function commonBinDirs(): string[] {
  const home = homedir();
  const dirs = [
    "/opt/homebrew/bin", // Apple Silicon Homebrew
    "/opt/homebrew/sbin",
    "/usr/local/bin", // Intel Homebrew + official Node.js installer
    "/usr/local/sbin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
    "/opt/local/bin", // MacPorts
    join(home, ".local", "bin"),
    join(home, ".npm-global", "bin"),
    join(home, ".npm-packages", "bin"),
    join(home, "bin"),
    join(home, ".volta", "bin"),
    join(home, "Library", "pnpm"),
    join(home, ".cargo", "bin"),
  ];

  // nvm — add the bin dir of every installed node version.
  const nvmDir = process.env.NVM_DIR || join(home, ".nvm");
  const nvmVersions = join(nvmDir, "versions", "node");
  if (existsSync(nvmVersions)) {
    try {
      for (const version of readdirSync(nvmVersions)) {
        dirs.push(join(nvmVersions, version, "bin"));
      }
    } catch {
      // ignore — fall back to the static list.
    }
  }

  // fnm — add the bin dir of every installed node version.
  const fnmDir =
    process.env.FNM_DIR || join(home, "Library", "Application Support", "fnm", "node-versions");
  if (existsSync(fnmDir)) {
    try {
      for (const version of readdirSync(fnmDir)) {
        dirs.push(join(fnmDir, version, "installation", "bin"));
      }
    } catch {
      // ignore
    }
  }

  return dirs;
}
