import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { GitHubIcon } from "../GitHubBadge";
import { PiChangelog } from "./PiChangelog";
import { DesktopChangelog } from "./DesktopChangelog";
import { SystemPanel } from "./SystemPanel";

interface AuthStatus {
  provider: string;
  authed: boolean;
  type?: string;
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
  const [updateStatus, setUpdateStatus] = useState<{
    status: "idle" | "checking" | "up-to-date" | "available" | "error";
    version?: string;
    message?: string;
  }>({ status: "idle" });
  const [updateChecking, setUpdateChecking] = useState(false);

  useEffect(() => {
    window.pi.api.getAuthStatus().then(setAuthStatus).catch(() => {});
    window.pi.api.getCwd().then(setCwd).catch(() => {});
    window.pi.github.getAuthStatus().then((s: GitHubAuth) => setGhAuth(s)).catch(() => {});
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateChecking(true);
    try {
      const result = await window.pi.events.checkForUpdates();
      if (result?.status === "error") {
        setUpdateStatus({ status: "error", message: result.message });
      } else if (result?.version) {
        setUpdateStatus({ status: "available", version: result.version });
      } else {
        setUpdateStatus({ status: "up-to-date" });
      }
    } catch (e) {
      setUpdateStatus({ status: "error", message: String(e) });
    }
    setUpdateChecking(false);
  };

  return (
    <div className="space-y-6">
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
        <div className="space-y-3">
          {authStatus.map((a) => (
            <div key={a.provider} className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium capitalize text-text">{a.provider}</span>
                <span className={`text-xs ${a.authed ? "text-success" : "text-text-faint"}`}>
                  {a.authed ? "Authenticated" : "Not set"}
                </span>
              </div>
              <div className="flex gap-2">
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
                    if (key) window.pi.api.setApiKey({ provider: a.provider, apiKey: key });
                  }}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                >
                  Save
                </button>
                {a.authed && (
                  <button
                    onClick={() => window.pi.api.logout({ provider: a.provider })}
                    className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:bg-danger/20"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
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

      <Section title="Compaction">
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const res = await window.pi.api.compact({ tabId: useAppStore.getState().activeTabId ?? undefined });
              if (res?.tokensBefore != null && res?.estimatedTokensAfter != null) {
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
          Manually compact context to reduce token usage. Auto-compaction runs
          when the context window is nearly full.
        </p>
      </Section>

      <Section title="Updates">
        <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text">Pi Desktop v0.1.4</p>
              <p className="text-xs text-text-faint">
                {updateStatus.status === "up-to-date" && "You're on the latest version."}
                {updateStatus.status === "available" && `Update ${updateStatus.version} is downloading...`}
                {updateStatus.status === "error" && `Error: ${updateStatus.message ?? "check failed"}`}
                {(updateStatus.status === "idle" || updateStatus.status === "checking") && "Check for new versions."}
              </p>
            </div>
            <button
              onClick={handleCheckForUpdates}
              disabled={updateChecking}
              className="rounded-lg border border-border bg-bg-hover px-3 py-2 text-xs text-text-muted hover:bg-bg-active disabled:opacity-40"
            >
              {updateChecking ? "Checking..." : "Check for Updates"}
            </button>
          </div>
        </div>
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
