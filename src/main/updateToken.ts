import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TOKEN_FILE = join(homedir(), ".pi-desktop-update-token");

let cachedRuntimeToken: string | undefined | null = null;

/**
 * Resolve an optional GitHub token used to authenticate the update check.
 *
 * The official repo is public and needs no token. Private forks can opt into
 * authenticated checks with ~/.pi-desktop-update-token. Tokens are never baked
 * into the application bundle, where they would be extractable by any user.
 *
 * Returns undefined when no token is configured, in which case the updater
 * falls back to an anonymous request (works for public repos).
 */
export function getUpdateToken(): string | undefined {
  // Only hit the filesystem once per process; cache the result.
  if (cachedRuntimeToken === null) {
    cachedRuntimeToken = existsSync(TOKEN_FILE)
      ? readFileSync(TOKEN_FILE, "utf8").trim() || undefined
      : undefined;
  }
  return cachedRuntimeToken;
}
