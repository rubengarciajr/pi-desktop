/**
 * MessageCache - caches converted chat messages by session file path.
 *
 * When switching tabs or sessions, pi returns raw AgentMessage[] objects
 * that must be converted to the renderer's ChatMessage format. This is
 * CPU-intensive for long conversations. This cache stores the result so
 * returning to a previously-viewed session is instant.
 */
interface CacheEntry {
  messages: any[];
  sessionFile: string;
  messageCount: number;
  cachedAt: number;
}

const CACHE_MAX = 50; // Keep last 50 sessions in memory
const CACHE_TTL_MS = 30 * 60_000; // Drop entries untouched for 30 minutes
const cache = new Map<string, CacheEntry>();

/** Get cached messages for a session file, or null if not cached / expired. */
export function getCachedMessages(sessionFile: string): any[] | null {
  const entry = cache.get(sessionFile);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(sessionFile);
    return null;
  }
  return entry.messages;
}

/** Store converted messages in the cache. */
export function setCachedMessages(sessionFile: string, messages: any[]) {
  if (!sessionFile) return;

  // Re-insert moves this key to the most-recent position (Map preserves
  // insertion order), making the first key the genuine LRU victim.
  cache.delete(sessionFile);
  if (cache.size >= CACHE_MAX) {
    const oldestKey = cache.keys().next().value; // O(1) — no full sort
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }

  cache.set(sessionFile, {
    // Store a shallow copy so a later mutation of the live session.messages
    // array can't silently rewrite cached history.
    messages: [...messages],
    sessionFile,
    messageCount: messages.length,
    cachedAt: Date.now(),
  });
}

/** Invalidate cache for a specific session (e.g., after new messages). */
export function invalidateCache(sessionFile: string) {
  cache.delete(sessionFile);
}

/** Clear entire cache. */
export function clearMessageCache() {
  cache.clear();
}

/** Get cache stats for debugging. */
export function getCacheStats() {
  return {
    size: cache.size,
    entries: [...cache.entries()].map(([k, v]) => ({
      sessionFile: k.split("/").pop(),
      messageCount: v.messageCount,
      ageMs: Date.now() - v.cachedAt,
    })),
  };
}
