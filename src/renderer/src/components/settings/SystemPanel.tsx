import { useEffect, useState } from "react";

export function SystemPanel() {
  const [piInstalled, setPiInstalled] = useState<boolean | null>(null);
  const [piVersion, setPiVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [modelsPath, setModelsPath] = useState("");

  useEffect(() => {
    checkPi();
    window.pi.api.modelsJsonPath().then(setModelsPath).catch(() => {});
  }, []);

  const checkPi = async () => {
    try {
      const res = await window.pi.api.checkPiInstalled();
      setPiInstalled(res.installed);
      setPiVersion(res.version ?? null);
    } catch {
      setPiInstalled(false);
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
        checkPi();
      } else {
        setInstallMsg(result?.error ?? "Installation failed.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Pi CLI */}
      <Section title="Pi CLI">
        <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text">
                {piInstalled === null
                  ? "Checking..."
                  : piInstalled
                  ? `Installed${piVersion ? ` (${piVersion})` : ""}`
                  : "Not installed"}
              </p>
              <p className="text-xs text-text-faint">
                The pi CLI powers the terminal experience. Required for some advanced features.
              </p>
            </div>
            <button
              onClick={handleInstall}
              disabled={installing || piInstalled === null}
              className={`no-drag rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40 ${
                piInstalled
                  ? "border border-border bg-bg-hover text-text-muted hover:bg-bg-active"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {installing ? "Installing..." : piInstalled ? "Reinstall" : "Install"}
            </button>
          </div>
          {installMsg && (
            <p className="mt-2 text-xs text-accent">{installMsg}</p>
          )}
        </div>
      </Section>

      {/* Models configuration */}
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
      </Section>

      {/* About */}
      <Section title="About">
        <div className="space-y-1 text-xs text-text-muted">
          <Row label="App version" value="0.1.0" />
          <Row label="Electron" value={window.pi?.versions?.electron ?? "—"} />
          <Row label="Node" value={window.pi?.versions?.node ?? "—"} />
          <Row label="Pi agent" value={window.pi?.versions?.pi ?? "—"} />
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
