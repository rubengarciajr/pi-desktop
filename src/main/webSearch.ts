/**
 * Web-search config manager — reads/writes ~/.pi/web-search.json so users can
 * add API keys (Exa / Perplexity / Gemini) and toggle browser-cookie access
 * from the GUI. Consumed by the pi-web-access package's web_search tool.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CONFIG_DIR = ".pi";

function getConfigPath(): string {
  return join(homedir(), CONFIG_DIR, "web-search.json");
}

export interface WebSearchConfig {
  exaApiKey?: string;
  perplexityApiKey?: string;
  geminiApiKey?: string;
  allowBrowserCookies?: boolean;
  /** "none" = headless (no browser curator); "summary-review" = open the
   *  in-browser result curator. We default to "none" so searches stay in-app. */
  workflow?: "none" | "summary-review";
}

export function getWebSearchConfig(): WebSearchConfig {
  const path = getConfigPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as WebSearchConfig;
  } catch {
    return {};
  }
}

/**
 * Merge a patch into the config. Empty-string key values clear that key (so the
 * UI can remove a key by blanking the field); `undefined` leaves it untouched.
 */
export function setWebSearchConfig(patch: WebSearchConfig): { success: boolean } {
  const current = getWebSearchConfig();
  const next: WebSearchConfig = { ...current };

  for (const key of ["exaApiKey", "perplexityApiKey", "geminiApiKey"] as const) {
    if (patch[key] === undefined) continue;
    const v = String(patch[key]).trim();
    if (v) next[key] = v;
    else delete next[key];
  }
  if (patch.allowBrowserCookies !== undefined) {
    next.allowBrowserCookies = patch.allowBrowserCookies;
  }
  if (patch.workflow !== undefined) {
    next.workflow = patch.workflow;
  }

  const dir = join(homedir(), CONFIG_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(next, null, 2) + "\n", "utf-8");
  return { success: true };
}

/**
 * Default web search to headless (no browser curator) the first time, without
 * overriding an explicit user choice. pi-web-access opens an interactive
 * browser page when `workflow` is unset and a UI is present — we don't want
 * that, so seed `workflow: "none"` if the key is absent.
 */
export function ensureHeadlessDefault(): void {
  try {
    const config = getWebSearchConfig();
    if (config.workflow === undefined) {
      setWebSearchConfig({ workflow: "none" });
    }
  } catch (err) {
    console.error("[web-search] ensureHeadlessDefault failed:", err);
  }
}

/** Status flags for the UI (presence only — never returns the raw keys). */
export function getWebSearchStatus(): {
  exa: boolean;
  perplexity: boolean;
  gemini: boolean;
  allowBrowserCookies: boolean;
  curator: boolean;
} {
  const c = getWebSearchConfig();
  return {
    exa: !!c.exaApiKey,
    perplexity: !!c.perplexityApiKey,
    gemini: !!c.geminiApiKey,
    allowBrowserCookies: !!c.allowBrowserCookies,
    // Curator (browser review) is on only when explicitly set to summary-review.
    curator: c.workflow === "summary-review",
  };
}
