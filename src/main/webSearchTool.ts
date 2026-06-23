/**
 * Native headless web search — a host-provided `web_search` tool registered via
 * the SDK's `customTools`. Runs entirely in-process (no browser, no curator) and
 * returns results to the chat.
 *
 * Backend tiers (best available wins):
 *   1. Exa API        (if exaApiKey set)        — high-quality results + text
 *   2. Perplexity API (if perplexityApiKey set) — synthesized answer + sources
 *   3. DuckDuckGo HTML (no key)                 — zero-config fallback
 *
 * If the `pi-web-access` package is installed, the caller skips registering this
 * tool so that package's richer `web_search` takes priority.
 */
import { getWebSearchConfig } from "./webSearch";

export interface NativeSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface NativeSearchOutput {
  provider: string;
  answer?: string;
  results: NativeSearchResult[];
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

async function searchExa(key: string, query: string, n: number, signal?: AbortSignal): Promise<NativeSearchResult[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ query, numResults: n, contents: { text: { maxCharacters: 600 } } }),
    signal,
  });
  if (!res.ok) throw new Error(`Exa API error ${res.status}`);
  const data: any = await res.json();
  return (data.results ?? []).map((r: any) => ({
    title: r.title ?? r.url ?? "result",
    url: r.url ?? "",
    snippet: String(r.text ?? r.snippet ?? "").slice(0, 600),
  }));
}

async function searchPerplexity(
  key: string,
  query: string,
  signal?: AbortSignal,
): Promise<{ answer: string; results: NativeSearchResult[] }> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: query }] }),
    signal,
  });
  if (!res.ok) throw new Error(`Perplexity API error ${res.status}`);
  const data: any = await res.json();
  const answer = data.choices?.[0]?.message?.content ?? "";
  const results: NativeSearchResult[] = (data.citations ?? []).map((u: string) => ({ title: u, url: u, snippet: "" }));
  return { answer, results };
}

async function searchDuckDuckGo(query: string, n: number, signal?: AbortSignal): Promise<NativeSearchResult[]> {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: new URLSearchParams({ q: query }).toString(),
    signal,
  });
  if (!res.ok) throw new Error(`DuckDuckGo error ${res.status}`);
  const html = await res.text();
  const results: NativeSearchResult[] = [];
  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets = [...html.matchAll(snippetRe)].map((m) => stripTags(m[1]));
  let i = 0;
  for (const m of html.matchAll(linkRe)) {
    const href = m[1];
    const uddg = /[?&]uddg=([^&]+)/.exec(href);
    const url = uddg ? decodeURIComponent(uddg[1]) : href.startsWith("//") ? `https:${href}` : href;
    results.push({ title: stripTags(m[2]), url, snippet: snippets[i] ?? "" });
    i++;
    if (results.length >= n) break;
  }
  return results;
}

/** Run a search via the best available backend. */
export async function nativeWebSearch(query: string, numResults = 5, signal?: AbortSignal): Promise<NativeSearchOutput> {
  const cfg = getWebSearchConfig();
  if (cfg.exaApiKey) {
    try {
      return { provider: "Exa", results: await searchExa(cfg.exaApiKey, query, numResults, signal) };
    } catch (err) {
      console.error("[web-search] Exa failed, falling back:", err);
    }
  }
  if (cfg.perplexityApiKey) {
    try {
      const r = await searchPerplexity(cfg.perplexityApiKey, query, signal);
      return { provider: "Perplexity", answer: r.answer, results: r.results };
    } catch (err) {
      console.error("[web-search] Perplexity failed, falling back:", err);
    }
  }
  return { provider: "DuckDuckGo", results: await searchDuckDuckGo(query, numResults, signal) };
}

function formatResults(query: string, out: NativeSearchOutput): string {
  const lines: string[] = [`Web search results for "${query}" (via ${out.provider}):`, ""];
  if (out.answer) {
    lines.push(out.answer.trim(), "");
    if (out.results.length) lines.push("Sources:");
  }
  for (const r of out.results) {
    lines.push(`- ${r.title}`);
    if (r.url) lines.push(`  ${r.url}`);
    if (r.snippet) lines.push(`  ${r.snippet}`);
  }
  if (out.results.length === 0 && !out.answer) {
    lines.push(
      "(No results. For more reliable search, add an Exa or Perplexity API key in Settings → Web Search.)",
    );
  }
  return lines.join("\n");
}

/** Build the host-provided `web_search` ToolDefinition (plain-JSON parameters). */
export function createNativeWebSearchTool(): any {
  return {
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web and return result titles, URLs, and snippets. Use this for current events, recent information, or specific people, places, organizations, businesses, products, or prices you are not certain about from training.",
    promptSnippet: "Search the web for current or specific information.",
    promptGuidelines: [
      "Call web_search when the user asks about specific people, places, organizations, businesses, products, prices, or current/recent events you are not certain of. Do not answer from memory when unsure, and do not tell the user to search themselves — search it for them and summarize the findings with sources.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", description: "The search query." },
        numResults: { type: "number", description: "Number of results to return (default 5, max 10)." },
      },
    },
    async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined) {
      const query = String(params?.query ?? "").trim();
      if (!query) {
        return { content: [{ type: "text", text: "Error: empty query." }], details: { error: "empty query" } };
      }
      const n = Math.min(Math.max(Number(params?.numResults) || 5, 1), 10);
      try {
        const out = await nativeWebSearch(query, n, signal);
        return { content: [{ type: "text", text: formatResults(query, out) }], details: out };
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        return {
          content: [
            {
              type: "text",
              text: `Web search failed: ${msg}. Add an Exa or Perplexity API key in Settings → Web Search for reliable results.`,
            },
          ],
          details: { error: msg },
        };
      }
    },
  };
}
