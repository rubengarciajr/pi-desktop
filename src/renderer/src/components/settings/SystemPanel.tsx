import { useEffect, useState } from "react";

interface SystemCheck {
  npm: boolean;
  node: boolean;
  git: boolean;
  pi: boolean;
}

export function SystemPanel() {
  const [sysCheck, setSysCheck] = useState<SystemCheck | null>(null);
  const [piVersion, setPiVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [modelsPath, setModelsPath] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    checkAll();
    window.pi.api.modelsJsonPath().then(setModelsPath).catch(() => {});
  }, []);

  const checkAll = async () => {
    try {
      const checks = await window.pi.api.systemCheck();
      setSysCheck(checks);
      if (checks.pi) {
        const piStatus = await window.pi.api.checkPiInstalled();
        setPiVersion(piStatus.version ?? null);
      }
    } catch {
      setSysCheck({ npm: false, node: false, git: false, pi: false });
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setInstallMsg(null);

    const offProgress = window.pi.events.onInstallProgress((p: any) => {
      setInstallMsg(p.message ?? "");
    });
    const offDone = window.pi.events.onInstallDone((result: any) => {
      offProgress();
      offDone();
      setInstalling(false);
      if (result?.success) {
        setInstallMsg("Installed successfully!");
        checkAll();
      } else {
        setInstallMsg(result?.error ?? "Installation failed.");
      }
    });

    // Actually start the installation
    try {
      await window.pi.api.startPiInstall();
    } catch (err: any) {
      offProgress();
      offDone();
      setInstalling(false);
      setInstallMsg(err?.message ?? "Failed to start installation.");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Dependency Status */}
      <Section title="System Status">
        <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3 space-y-2.5">
          <DependencyRow
            label="Node.js"
            description="Required for installing pi packages and extensions"
            installed={sysCheck?.node ?? null}
          />
          <DependencyRow
            label="npm"
            description="Required for installing pi packages from npm registry"
            installed={sysCheck?.npm ?? null}
          />
          <DependencyRow
            label="Git"
            description="Required for GitHub integration and version control"
            installed={sysCheck?.git ?? null}
          />
          <DependencyRow
            label="Pi CLI"
            description={`Optional. ${sysCheck?.pi ? `Installed${piVersion ? ` (${piVersion})` : ""}` : "Not installed - only needed for terminal use"}`}
            installed={sysCheck?.pi ?? null}
            optional
          />
        </div>
        {sysCheck && !sysCheck.npm && (
          <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5">
            <p className="text-xs text-text-muted">
              <span className="font-medium text-warning">Node.js not found.</span>{" "}
              Pi Desktop works without it, but installing packages and extensions requires Node.js.
            </p>
            <a
              href="https://nodejs.org"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-accent hover:underline"
            >
              Download Node.js from nodejs.org
            </a>
          </div>
        )}
      </Section>

      {/* Pi CLI */}
      <Section title="Pi CLI (optional)">
        <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-text">
                {sysCheck?.pi === null
                  ? "Checking..."
                  : sysCheck?.pi
                  ? `Installed${piVersion ? ` (${piVersion})` : ""}`
                  : "Not installed"}
              </p>
              <p className="text-xs text-text-faint">
                Optional. Pi Desktop works without it. Install only if you want the terminal experience.
              </p>
            </div>
            <button
              onClick={handleInstall}
              disabled={installing || sysCheck?.npm === false}
              className={`no-drag shrink-0 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40 ${
                sysCheck?.pi
                  ? "border border-border bg-bg-hover text-text-muted hover:bg-bg-active"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {installing ? "Installing..." : sysCheck?.pi ? "Reinstall" : "Install"}
            </button>
          </div>
          {installMsg && (
            <p className="mt-2 text-xs text-accent">{installMsg}</p>
          )}
          {sysCheck?.npm === false && (
            <p className="mt-2 text-xs text-text-faint">
              Requires Node.js/npm. Install Node.js first, then restart Pi Desktop.
            </p>
          )}
        </div>

        {/* Quick install commands */}
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-text-faint">Or install from Terminal:</p>
          <CopyableCode
            id="npm"
            text="npm install -g --ignore-scripts @earendil-works/pi-coding-agent"
            copied={copied === "npm"}
            onCopy={copyToClipboard}
          />
          <CopyableCode
            id="curl"
            text="curl -fsSL https://pi.dev/install.sh | sh"
            copied={copied === "curl"}
            onCopy={copyToClipboard}
          />
        </div>

        <div className="mt-3 flex gap-3">
          <a
            href="https://pi.dev"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            pi.dev
          </a>
          <span className="text-text-faint">|</span>
          <a
            href="https://pi.dev/docs/latest"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Documentation
          </a>
          <span className="text-text-faint">|</span>
          <a
            href="https://pi.dev/docs/latest/quickstart"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Quickstart Guide
          </a>
        </div>
      </Section>

      {/* Model configuration */}
      <Section title="Model configuration">
        <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text">Custom models</p>
              <p className="truncate text-xs font-mono text-text-faint">{modelsPath || "..."}</p>
              <p className="mt-1 text-xs text-text-faint">
                Add models from the Model tab. This file is read automatically.
              </p>
            </div>
            <button
              onClick={() => window.pi.api.openModelsJson()}
              className="no-drag shrink-0 rounded-lg border border-border bg-bg-hover px-3 py-2 text-xs text-text-muted hover:bg-bg-active"
            >
              Show in Finder
            </button>
          </div>
        </div>
        <a
          href="https://pi.dev/docs/latest/models"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-accent hover:underline"
        >
          Custom models documentation
        </a>
      </Section>

      {/* About */}
      <Section title="About">
        <div className="space-y-1 text-xs text-text-muted">
          <Row label="App version" value={window.pi?.versions?.app ?? "—"} />
          <Row label="Electron" value={window.pi?.versions?.electron ?? "—"} />
          <Row label="Node (bundled)" value={window.pi?.versions?.node ?? "—"} />
          <Row label="Pi agent SDK" value={window.pi?.versions?.pi ?? "—"} />
        </div>
      </Section>
    </div>
  );
}

function DependencyRow({ label, description, installed, optional }: { label: string; description: string; installed: boolean | null; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text">{label}</span>
          {optional && <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[9px] text-text-faint">optional</span>}
        </div>
        <p className="text-xs text-text-faint">{description}</p>
      </div>
      <div className="shrink-0 ml-3">
        {installed === null ? (
          <span className="text-xs text-text-faint">...</span>
        ) : installed ? (
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={optional ? "#a1a1aa" : "#ef4444"} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
    </div>
  );
}

function CopyableCode({ id, text, copied, onCopy }: { id: string; text: string; copied: boolean; onCopy: (text: string, id: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
      <code className="flex-1 truncate font-mono text-xs text-text-muted">{text}</code>
      <button
        onClick={() => onCopy(text, id)}
        className="no-drag shrink-0 rounded-md border border-border bg-bg-hover px-2 py-1 text-[10px] text-text-faint hover:text-text"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
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
