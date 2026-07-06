import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TOKEN_FILE = join(homedir(), ".pi-desktop-update-token");

// Populated at build time by electron.vite.config.ts (reads .env / CI secret).
// `string` when present, `undefined` when absent — never the literal "undefined".
const envToken = import.meta.env?.PI_UPDATE_TOKEN;
const BAKED_TOKEN =
  typeof envToken === "string" && envToken.length > 0 ? envToken : undefined;

let cachedRuntimeToken: string | undefined | null = null;

/**
 * Resolve an optional GitHub token used to authenticate the update check.
 *
 * The repo is private, so anonymous calls to the releases API return 404 and
 * the update banner never appears. A read-only PAT fixes this. Resolution
 * order:
 *
 *   1. Build-time value from PI_UPDATE_TOKEN (.env locally, CI secret in
 *      Actions) — baked into the shipped binary, no setup needed for end users.
 *   2. ~/.pi-desktop-update-token — lets a user override/replace the token
 *      without rebuilding (advanced users / token rotation).
 *
 * Returns undefined when no token is configured, in which case the updater
 * falls back to an anonymous request (works for public repos).
 */
export function getUpdateToken(): string | undefined {
  if (BAKED_TOKEN) return BAKED_TOKEN;

  // Only hit the filesystem once per process; cache the result.
  if (cachedRuntimeToken === null) {
    cachedRuntimeToken = existsSync(TOKEN_FILE)
      ? readFileSync(TOKEN_FILE, "utf8").trim() || undefined
      : undefined;
  }
  return cachedRuntimeToken;
}
