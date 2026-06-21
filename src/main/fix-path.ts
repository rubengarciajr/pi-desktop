import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

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
 *   1. the user's real login-shell PATH (so it matches their terminal), and
 *   2. a set of well-known install locations as a robust fallback.
 *
 * Call this ONCE, as early as possible in the main process, before anything
 * spawns a child process.
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

  // 1. The user's real login-shell PATH (most accurate — matches their terminal).
  add(getLoginShellPath());

  // 2. Whatever PATH we already have (don't lose anything inherited).
  add(process.env.PATH);

  // 3. Known-good fallbacks, so node/npm/pi resolve even if the shell probe
  //    failed (e.g. a non-standard or non-interactive shell).
  for (const dir of commonBinDirs()) {
    if (existsSync(dir)) add(dir);
  }

  process.env.PATH = parts.join(delimiter);
}

/**
 * Ask the user's login shell what its PATH is. Uses an interactive login shell
 * (`-ilc`) so it sources the same profile files the user's terminal does
 * (`.zprofile`/`.zshrc`, `.bash_profile`/`.bashrc`, etc.). Markers bracket the
 * value so we can parse it cleanly even if the shell prints other noise.
 */
function getLoginShellPath(): string {
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    const out = execFileSync(
      shell,
      ["-ilc", 'printf "__PI_PATH_START__%s__PI_PATH_END__" "$PATH"'],
      {
        encoding: "utf-8",
        timeout: 5000,
        // Ignore stdin so an interactive shell can't hang waiting for input.
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const match = out.match(/__PI_PATH_START__(.*?)__PI_PATH_END__/s);
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
