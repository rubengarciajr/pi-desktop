import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { GitHubIcon } from "../GitHubBadge";
import { PiChangelog } from "./PiChangelog";
import { DesktopChangelog } from "./DesktopChangelog";
import { SystemPanel } from "./SystemPanel";

interface AuthStatus {
  provider: string;
  name?: string;
  authed: boolean;
  loginType?: "oauth" | "apiKey";
  type?: "apiKey" | "oauth";
}

interface GitHubAuth {
  authenticated: boolean;
  username?: string;
  avatarUrl?: string;
  error?: string;
}

type SettingsTab = "settings" | "system" | "desktop-changelog" | "pi-changelog";

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>("settings");

  return (
    <div className="flex h-full flex-col">
      <div className="drag-region h-14 shrink-0" />
      <div className="no-drag flex gap-1 border-b border-border px-6">
        <SettingsTabButton active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </SettingsTabButton>
        <SettingsTabButton active={tab === "system"} onClick={() => setTab("system")}>
          System
        </SettingsTabButton>
        <SettingsTabButton active={tab === "desktop-changelog"} onClick={() => setTab("desktop-changelog")}>
          Desktop Changelog
        </SettingsTabButton>
        <SettingsTabButton active={tab === "pi-changelog"} onClick={() => setTab("pi-changelog")}>
          Pi Agent Changelog
        </SettingsTabButton>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {tab === "settings" && <SettingsPanel />}
        {tab === "system" && <SystemPanel />}
        {tab === "desktop-changelog" && <DesktopChangelog />}
        {tab === "pi-changelog" && <PiChangelog />}
      </div>
    </div>
  );
}

function SettingsTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-sm transition-colors ${
        active ? "text-text" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
    </button>
  );
}

function SettingsPanel() {
  const piState = useAppStore((s) => s.activeTab.piState);
  const [authStatus, setAuthStatus] = useState<AuthStatus[]>([]);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [cwd, setCwd] = useState("");
  const [compactResult, setCompactResult] = useState<string | null>(null);
  const [ghAuth, setGhAuth] = useState<GitHubAuth>({ authenticated: false });
  const [ghToken, setGhToken] = useState("");
  const [ghVerifying, setGhVerifying] = useState(false);

  // Re-fetch auth status (called after login/logout/apiKey-save so the UI updates).
  const refreshAuth = useCallback(() => {
    window.pi.api.getAuthStatus().then(setAuthStatus).catch(() => {});
  }, []);

  useEffect(() => {
    refreshAuth();
    window.pi.api.getCwd().then(setCwd).catch(() => {});
    window.pi.github.getAuthStatus().then((s: GitHubAuth) => setGhAuth(s)).catch(() => {});
  }, [refreshAuth]);

  // Reflect OAuth results live. The device-code flow finishes in the main
  // process, so without this the row kept showing "Not connected" until the
  // view was remounted — users reasonably read that as a failed login and
  // restarted the app. ModelView already did this; Settings did not.
  useEffect(() => {
    const off = window.pi.events.onAuthEvent((message: any) => {
      if (message?.kind === "done" || message?.kind === "error") refreshAuth();
    });
    return () => { off?.(); };
  }, [refreshAuth]);

  return (
    <div className="space-y-6">
      <AppearanceSection />

      <Section title="Working directory">
        <div className="flex items-center gap-2">
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-text-mono font-mono focus:border-accent/50 focus:outline-none selectable"
          />
          <button
            onClick={async () => {
              const dir = await window.pi.api.pickDirectory();
              if (dir) setCwd(dir);
            }}
            className="rounded-lg border border-border bg-bg-hover px-3 py-2 text-xs text-text-muted hover:bg-bg-active"
          >
            Browse
          </button>
          <button
            onClick={() => window.pi.api.setCwd({ cwd })}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Apply
          </button>
        </div>
      </Section>

      <Section title="Authentication">
        <p className="mb-3 text-xs text-text-faint">
          Log in with your Claude Pro/Max, ChatGPT, or Copilot subscription — no API key needed.
          Or paste an API key for any provider.
        </p>
        <div className="space-y-3">
          {authStatus.map((a) => {
            const label = a.name || a.provider.charAt(0).toUpperCase() + a.provider.slice(1);
            const supportsOAuth = a.loginType === "oauth";
            const isOauth = a.type === "oauth";
            return (
              <div key={a.provider} className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{label}</span>
                    {a.authed && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        isOauth ? "bg-accent/15 text-accent" : "bg-success/15 text-success"
                      }`}>
                        {isOauth ? "Subscription" : "API key"}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${a.authed ? "text-success" : "text-text-faint"}`}>
                    {a.authed ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {supportsOAuth && (
                    <button
                      onClick={() => {
                        window.pi.api.login({ provider: a.provider }).catch(() => {});
                      }}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                    >
                      {a.authed ? "Reconnect subscription" : "Log in with subscription"}
                    </button>
                  )}
                  <input
                    type="password"
                    placeholder={`${a.provider.toUpperCase()}_API_KEY`}
                    value={apiKeyInputs[a.provider] ?? ""}
                    onChange={(e) =>
                      setApiKeyInputs((s) => ({ ...s, [a.provider]: e.target.value }))
                    }
                    className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-mono text-text focus:border-accent/50 focus:outline-none selectable"
                  />
                  <button
                    onClick={() => {
                      const key = apiKeyInputs[a.provider];
                      if (key) {
                        window.pi.api.setApiKey({ provider: a.provider, apiKey: key }).then(() => refreshAuth());
                      }
                    }}
                    className="rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted hover:bg-bg-active hover:text-text"
                  >
                    Save key
                  </button>
                  {a.authed && (
                    <button
                      onClick={() => window.pi.api.logout({ provider: a.provider }).then(() => refreshAuth())}
                      className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:bg-danger/20"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="GitHub">
        {ghAuth.authenticated ? (
          <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {ghAuth.avatarUrl ? (
                  <img src={ghAuth.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <GitHubIcon size={18} color="#a855f7" />
                )}
                <span className="text-sm font-medium text-text">{ghAuth.username}</span>
              </div>
              <button
                onClick={async () => {
                  await window.pi.github.logout();
                  setGhAuth({ authenticated: false });
                }}
                className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:bg-danger/20"
              >
                Disconnect
              </button>
            </div>
            <p className="mt-2 text-xs text-text-faint">
              Connected. Open a project folder and use the GitHub icon in the prompt bar to sync.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <GitHubIcon size={18} color="#a855f7" />
              <span className="text-sm font-medium text-text">Master Login</span>
            </div>
            <p className="mb-3 text-xs text-text-faint">
              Connect your GitHub account to push and pull projects across computers.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-mono text-text focus:border-accent/50 focus:outline-none selectable"
              />
              <button
                onClick={async () => {
                  setGhVerifying(true);
                  try {
                    const res: GitHubAuth = await window.pi.github.verifyToken({ token: ghToken.trim() });
                    setGhAuth(res);
                    if (res.authenticated) setGhToken("");
                  } catch {}
                  setGhVerifying(false);
                }}
                disabled={ghVerifying || !ghToken.trim()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                {ghVerifying ? "Verifying..." : "Connect"}
              </button>
            </div>
            {ghAuth.error && (
              <p className="mt-1.5 text-[10px] text-danger">{ghAuth.error}</p>
            )}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Pi%20Desktop"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[10px] text-accent hover:underline"
            >
              Create a new token on GitHub
            </a>
          </div>
        )}
      </Section>

      <WebSearchSection />

      <Section title="Compaction">
        {/* Auto-compaction toggle (per session) */}
        <label className="mb-3 flex items-center justify-between rounded-lg border border-border bg-bg-subtle px-4 py-2.5">
          <div>
            <div className="text-sm text-text">Auto-compaction</div>
            <div className="text-[11px] text-text-faint">
              Automatically summarize old context before the window overflows. Recommended.
            </div>
          </div>
          <input
            type="checkbox"
            checked={piState.autoCompactionEnabled ?? true}
            onChange={(e) => {
              const enabled = e.target.checked;
              const tabId = useAppStore.getState().activeTabId ?? undefined;
              window.pi.api.setAutoCompaction({ enabled, tabId }).catch(() => {});
              if (tabId) useAppStore.getState().setTabPiState(tabId, { autoCompactionEnabled: enabled });
            }}
            className="h-4 w-4 accent-accent"
          />
        </label>

        {/* Context usage readout */}
        {piState.contextWindow != null && piState.contextTokens != null && (
          <div className="mb-3 text-xs text-text-muted">
            Context: {piState.contextTokens.toLocaleString()} / {piState.contextWindow.toLocaleString()} tokens
            {piState.contextWindow > 0 && (
              <span className={`ml-1 ${piState.contextTokens / piState.contextWindow > 0.9 ? "text-warning" : "text-text-faint"}`}>
                ({Math.round((piState.contextTokens / piState.contextWindow) * 100)}%)
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={async () => {
              const res: any = await window.pi.api.compact({ tabId: useAppStore.getState().activeTabId ?? undefined });
              if (res && res.success === false) {
                setCompactResult(res.error || "Nothing to compact.");
              } else if (res?.tokensBefore != null && res?.estimatedTokensAfter != null) {
                const pct = res.tokensBefore > 0 ? Math.round((1 - res.estimatedTokensAfter / res.tokensBefore) * 100) : 0;
                setCompactResult(`Compacted: ${res.tokensBefore.toLocaleString()} → ${res.estimatedTokensAfter.toLocaleString()} tokens (-${pct}%)`);
              } else {
                setCompactResult("Compaction complete.");
              }
            }}
            disabled={piState.isStreaming}
            className="rounded-lg border border-border bg-bg-hover px-3 py-2 text-xs text-text-muted hover:bg-bg-active disabled:opacity-40"
          >
            Compact now
          </button>
          <button
            onClick={() => window.pi.api.abortCompaction()}
            className="rounded-lg border border-border bg-bg-hover px-3 py-2 text-xs text-text-muted hover:bg-bg-active"
          >
            Abort
          </button>
        </div>
        {compactResult && (
          <p className="mt-1.5 text-xs text-accent">{compactResult}</p>
        )}
        <p className="mt-2 text-xs text-text-faint">
          Manually compact context, or type <span className="font-mono">/compact</span> in the chat.
          Each session compacts independently.
        </p>
      </Section>

      <Section title="Session info">
        <div className="space-y-1 text-xs text-text-muted">
          <Row label="Session ID" value={piState.sessionId ?? "—"} />
          <Row label="Messages" value={String(piState.messageCount ?? 0)} />
          <Row label="Model" value={piState.modelId ?? "—"} />
        </div>
      </Section>
    </div>
  );
}

interface WebSearchStatus {
  exa: boolean;
  perplexity: boolean;
  gemini: boolean;
  allowBrowserCookies: boolean;
  curator: boolean;
  webAccessInstalled: boolean;
}

const WEB_PROVIDERS = [
  { key: "exaApiKey" as const, label: "Exa", statusKey: "exa" as const, placeholder: "exa-…" },
  { key: "perplexityApiKey" as const, label: "Perplexity", statusKey: "perplexity" as const, placeholder: "pplx-…" },
  { key: "geminiApiKey" as const, label: "Gemini", statusKey: "gemini" as const, placeholder: "AIza…" },
];

function WebSearchSection() {
  const [status, setStatus] = useState<WebSearchStatus | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const refresh = () =>
    window.pi.api.getWebSearchStatus().then((s: WebSearchStatus) => setStatus(s)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const saveKey = async (key: string, value: string) => {
    await window.pi.api.setWebSearchConfig({ [key]: value.trim() } as any).catch(() => {});
    setKeys((k) => ({ ...k, [key]: "" }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    refresh();
  };

  const toggleCookies = async (enabled: boolean) => {
    await window.pi.api.setWebSearchConfig({ allowBrowserCookies: enabled }).catch(() => {});
    refresh();
  };

  // Gemini key / browser cookies / curator are pi-web-access-only; hide them in
  // native mode. Native search uses Exa/Perplexity (else no-key DuckDuckGo).
  const installed = status?.webAccessInstalled ?? false;
  const providers = WEB_PROVIDERS.filter((p) => installed || p.key !== "geminiApiKey");

  return (
    <Section title={installed ? "Web Search" : "Web Search (built-in)"}>
      <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <p className="mb-3 text-xs text-text-faint">
          {installed ? (
            <>
              Powered by the <span className="font-mono">pi-web-access</span> package. Add provider keys below, or
              enable the 🔍 Web toggle in a chat.
            </>
          ) : (
            <>
              Built-in web search works with no key (DuckDuckGo). Add an Exa or Perplexity key for higher-quality
              results, then enable the 🔍 Web toggle in a chat.
            </>
          )}
        </p>
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-text-muted">{p.label}</span>
              <input
                type="password"
                placeholder={status?.[p.statusKey] ? "•••••••• (set)" : p.placeholder}
                value={keys[p.key] ?? ""}
                onChange={(e) => setKeys((k) => ({ ...k, [p.key]: e.target.value }))}
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-mono text-text focus:border-accent/50 focus:outline-none selectable"
              />
              <button
                onClick={() => saveKey(p.key, keys[p.key] ?? "")}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Save
              </button>
              {status?.[p.statusKey] && (
                <button
                  onClick={() => saveKey(p.key, "")}
                  className="rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/20"
                  title="Clear key"
                >
                  Clear
                </button>
              )}
            </div>
          ))}
        </div>
        {installed && (
          <>
            <label className="mt-3 flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={status?.allowBrowserCookies ?? false}
                onChange={(e) => toggleCookies(e.target.checked)}
                className="accent-accent"
              />
              Allow browser cookies (enables Gemini Web search)
            </label>
            <label className="mt-2 flex items-start gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={status?.curator ?? false}
                onChange={async (e) => {
                  await window.pi.api
                    .setWebSearchConfig({ workflow: e.target.checked ? "summary-review" : "none" })
                    .catch(() => {});
                  refresh();
                }}
                className="mt-0.5 accent-accent"
              />
              <span>
                Review results in a browser (curator)
                <span className="mt-0.5 block text-[10px] text-text-faint">
                  Off (recommended): searches run in the background and return to the chat. On: opens an interactive result picker in your browser.
                </span>
              </span>
            </label>
          </>
        )}
        {saved && <p className="mt-2 text-[10px] text-success">Saved.</p>}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5">
      <span>{label}</span>
      <span className="font-mono text-text-faint">{value}</span>
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: "auto" },
  { value: "dark", label: "Dark", icon: "dark" },
  { value: "light", label: "Light", icon: "light" },
] as const;

const ACCENT_PRESETS = [
  { value: "purple", color: "#7c5cff" },
  { value: "blue", color: "#3b82f6" },
  { value: "green", color: "#22c55e" },
  { value: "orange", color: "#f97316" },
  { value: "pink", color: "#ec4899" },
  { value: "teal", color: "#14b8a6" },
  { value: "red", color: "#ef4444" },
] as const;

function AppearanceSection() {
  const [themePref, setThemePref] = useState<"system" | "dark" | "light">(
    () => (localStorage.getItem("pi-theme") as any) || "system"
  );
  const [accentPref, setAccentPref] = useState<string>(
    () => localStorage.getItem("pi-accent") || "purple"
  );

  // Desktop UI prefs persisted in the main process (userData/app-settings.json).
  const [density, setDensity] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [externalEditor, setExternalEditor] = useState("");

  useEffect(() => {
    window.pi.api.getAppSettings().then((s) => {
      setDensity(s.messageDensity);
      setExternalEditor(s.externalEditor);
    }).catch(() => {});
  }, []);

  const applyDensity = (value: "compact" | "comfortable" | "spacious") => {
    setDensity(value);
    document.documentElement.setAttribute("data-msg-density", value);
    window.pi.api.setAppSettings({ patch: { messageDensity: value } }).catch(() => {});
  };

  const saveExternalEditor = (value: string) => {
    window.pi.api.setAppSettings({ patch: { externalEditor: value.trim() } }).catch(() => {});
  };

  // Determine effective theme (resolve "system" to dark/light)
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    window.pi.events.getTheme().then((t) => setSystemDark(t.shouldUseDarkColors));
    const off = window.pi.events.onThemeChanged((data: any) => {
      setSystemDark(data.shouldUseDarkColors);
    });
    return () => { off?.(); };
  }, []);

  const effectiveTheme =
    themePref === "system" ? (systemDark ? "dark" : "light") : themePref;

  const applyTheme = (pref: "system" | "dark" | "light") => {
    setThemePref(pref);
    localStorage.setItem("pi-theme", pref);
    window.pi.events.setTheme(pref);
    // Update DOM
    const resolved = pref === "system" ? (systemDark ? "dark" : "light") : pref;
    document.documentElement.setAttribute("data-theme", resolved);
  };

  const applyAccent = (accent: string) => {
    setAccentPref(accent);
    localStorage.setItem("pi-accent", accent);
    document.documentElement.setAttribute("data-accent", accent);
  };

  // Apply on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.setAttribute("data-accent", accentPref);
  }, [effectiveTheme, accentPref]);

  return (
    <Section title="Appearance">
      <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3 space-y-4">
        {/* Theme */}
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">Theme</p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => applyTheme(opt.value)}
                className={`no-drag flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  themePref === opt.value
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-bg text-text-muted hover:bg-bg-hover"
                }`}
              >
                <ThemeIcon type={opt.icon} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">Accent color</p>
          <div className="flex items-center gap-2.5">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => applyAccent(preset.value)}
                className={`no-drag h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                  accentPref === preset.value ? "ring-2 ring-offset-2 ring-offset-bg-subtle" : ""
                }`}
                style={{
                  backgroundColor: preset.color,
                  boxShadow: accentPref === preset.value ? `0 0 0 2px ${preset.color}` : "none",
                }}
                title={preset.value}
              />
            ))}
          </div>
        </div>

        {/* Message density — GUI analog of Pi's terminal outputPad. */}
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">Message spacing</p>
          <div className="flex gap-2">
            {(["compact", "comfortable", "spacious"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => applyDensity(opt)}
                className={`no-drag rounded-lg border px-3 py-1.5 text-xs capitalize transition-colors ${
                  density === opt
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-bg text-text-muted hover:bg-bg-hover"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-text-faint">Horizontal padding around messages in the conversation.</p>
        </div>

        {/* External editor — Pi 0.80.3 externalEditor, for the prompt input. */}
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">External editor</p>
          <input
            type="text"
            value={externalEditor}
            onChange={(e) => setExternalEditor(e.target.value)}
            onBlur={(e) => saveExternalEditor(e.target.value)}
            placeholder="code --wait"
            spellCheck={false}
            className="no-drag w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text placeholder:text-text-faint focus:border-accent/40 focus:outline-none"
          />
          <p className="mt-1.5 text-[11px] text-text-faint">
            Command used by the editor button in the prompt bar. Use a GUI editor with a blocking flag (e.g.
            <span className="mx-1 font-mono">code --wait</span>,
            <span className="mx-1 font-mono">subl -w</span>). Leave blank to use $VISUAL / $EDITOR.
          </p>
        </div>
      </div>
    </Section>
  );
}

function ThemeIcon({ type }: { type: "auto" | "dark" | "light" }) {
  if (type === "auto") {
    return (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M12 4v16" />
        <path d="M8 8h.01M16 8h.01M8 12h.01M16 12h.01" />
      </svg>
    );
  }
  if (type === "dark") {
    return (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
