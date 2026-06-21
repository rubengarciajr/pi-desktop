/**
 * MessageCache - caches converted chat messages by session file path.
 *
 * When switching tabs or sessions, pi returns raw AgentMessage[] objects
 * that must be converted to the renderer's ChatMessage format. This is
 * CPU-intensive for long conversations. This cache stores the result so
 * returning to a previously-viewed session is instant.
 */
import { EventEmitter } from "node:events";

interface CacheEntry {
  messages: any[];
  sessionFile: string;
  messageCount: number;
  cachedAt: number;
}

const CACHE_MAX = 50; // Keep last 50 sessions in memory
const cache = new Map<string, CacheEntry>();

export const messageCacheEvents = new EventEmitter();
export const MESSAGE_CACHE_HIT = "cache:hit";
export const MESSAGE_CACHE_MISS = "cache:miss";

/** Get cached messages for a session file, or null if not cached. */
export function getCachedMessages(sessionFile: string): any[] | null {
  const entry = cache.get(sessionFile);
  if (!entry) {
    messageCacheEvents.emit(MESSAGE_CACHE_MISS, sessionFile);
    return null;
  }
  messageCacheEvents.emit(MESSAGE_CACHE_HIT, sessionFile);
  return entry.messages;
}

/** Store converted messages in the cache. */
export function setCachedMessages(sessionFile: string, messages: any[]) {
  if (!sessionFile) return;

  // Evict oldest if at capacity.
  if (cache.size >= CACHE_MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }

  cache.set(sessionFile, {
    messages,
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
