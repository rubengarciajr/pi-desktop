/**
 * SharedDepsCache - caches expensive SDK objects that are identical
 * across all session managers (same agentDir = same deps).
 *
 * CRITICAL: We cache ONLY stateless objects (AuthStorage, ModelRegistry,
 * SettingsManager). We must NOT cache AgentSessionServices because its
 * resourceLoader holds an extension runner that gets INVALIDATED when
 * sessions are replaced (switch/fork/new/clone). Reusing a cached services
 * object across session replacements causes "stale extension ctx" errors.
 */
import { join } from "node:path";

interface CachedDeps {
  authStorage: any;
  modelRegistry: any;
  settingsManager: any;
  agentDir: string;
  createdAt: number;
}

const cache = new Map<string, CachedDeps>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Get or create cached stateless deps for an agentDir. */
export async function getSharedDeps(
  agentDir: string,
  pi: typeof import("@earendil-works/pi-coding-agent"),
  cwd: string,
): Promise<CachedDeps> {
  const key = agentDir;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    // Reuse auth/model but refresh cwd-dependent settings manager.
    return {
      ...cached,
      settingsManager: pi.SettingsManager.create(cwd, agentDir),
    };
  }

  // Create fresh deps - AuthStorage and ModelRegistry read JSON files.
  const authStorage = pi.AuthStorage.create();
  const modelRegistry = pi.ModelRegistry.create(
    authStorage,
    join(agentDir, "models.json"),
  );
  const settingsManager = pi.SettingsManager.create(cwd, agentDir);

  const deps: CachedDeps = {
    authStorage,
    modelRegistry,
    settingsManager,
    agentDir,
    createdAt: Date.now(),
  };

  cache.set(key, deps);
  return deps;
}

/** Invalidate cache (call after install/remove packages). */
export function invalidateSharedDeps() {
  cache.clear();
}
