import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";

interface SystemCheck {
  npm: boolean;
  node: boolean;
  git: boolean;
  pi: boolean;
}

export function SystemPanel() {
  const sdkVersion = useAppStore((s) => s.sdkVersion);
  const [sysCheck, setSysCheck] = useState<SystemCheck | null>(null);
  const [modelsPath, setModelsPath] = useState("");

  useEffect(() => {
    checkAll();
    window.pi.api.modelsJsonPath().then(setModelsPath).catch(() => {});
  }, []);

  const checkAll = async () => {
    try {
      setSysCheck(await window.pi.api.systemCheck());
    } catch {
      setSysCheck({ npm: false, node: false, git: false, pi: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Dependency Status */}
      <Section title="System Status">
        <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3 space-y-2.5">
          <DependencyRow
            label="Node.js"
            description="Needed only when installing packages/extensions — Pi Desktop itself runs without it"
            installed={sysCheck?.node ?? null}
            optional
          />
          <DependencyRow
            label="npm"
            description="Needed only when installing packages from the npm registry"
            installed={sysCheck?.npm ?? null}
            optional
          />
          <DependencyRow
            label="Git"
            description="Needed for GitHub integration and version control"
            installed={sysCheck?.git ?? null}
            optional
          />
          <DependencyRow
            label="Pi CLI"
            description={`Terminal-only. Pi Desktop runs the agent SDK in-process and does not need the CLI${
              sysCheck?.pi ? " (installed)" : ""
            }`}
            installed={sysCheck?.pi ?? null}
            optional
          />
        </div>
        {sysCheck && !sysCheck.npm && (
          <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5">
            <p className="text-xs text-text-muted">
              <span className="font-medium text-warning">npm not found.</span>{" "}
              Pi Desktop works without it, but installing packages and extensions requires Node.js/npm.
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
        <p className="mt-2 text-xs text-text-faint">
          Pi Desktop runs the Pi agent SDK directly — no CLI installation required.
          {" "}
          <a
            href="https://pi.dev/docs/latest/quickstart"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Install the CLI
          </a>{" "}
          only if you also want the terminal experience.
        </p>
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
          <Row label="Pi agent SDK" value={sdkVersion || window.pi?.versions?.pi || "—"} />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-faint">{label}</span>
      <span className="font-mono text-text">{value}</span>
    </div>
  );
}
