/**
 * Resolves the installed `@earendil-works/pi-coding-agent` version at runtime,
 * straight from the SDK's own `VERSION` export. This replaces the hardcoded
 * version strings that used to drift after every bump — callers now read the
 * value the SDK reports about itself.
 *
 * The promise is cached so repeated calls (one per IPC request) don't re-import
 * the SDK.
 */
let cached: string | null = null;
let pending: Promise<string> | null = null;

export async function getSdkVersion(): Promise<string> {
  if (cached) return cached;
  if (!pending) {
    pending = (async () => {
      try {
        const pi = await import("@earendil-works/pi-coding-agent");
        const v = (pi as { VERSION?: string }).VERSION;
        if (v) cached = v;
        return v ?? "unknown";
      } catch {
        return "unknown";
      }
    })();
  }
  return pending;
}
