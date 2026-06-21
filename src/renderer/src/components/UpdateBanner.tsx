import { useEffect, useState } from "react";

interface UpdateState {
  status: "idle" | "available" | "up-to-date" | "error";
  version?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  message?: string;
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [dismissed, setDismissed] = useState(false);

  // Check for updates on mount
  useEffect(() => {
    const check = async () => {
      try {
        const result = await window.pi.events.checkForUpdates();
        if (result?.status === "available") {
          setState({
            status: "available",
            version: result.version,
            downloadUrl: result.downloadUrl,
            releaseUrl: result.releaseUrl,
          });
        }
      } catch {}
    };

    // Check after a short delay
    const timer = setTimeout(check, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (state.status !== "available" || dismissed) return null;

  return (
    <div className="no-drag fixed bottom-10 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
      <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-bg-active px-4 py-2.5 shadow-2xl">
        <span className="flex h-2 w-2 animate-pulse-subtle rounded-full bg-accent" />
        <span className="text-sm text-text">
          Pi Desktop v{state.version} is available
        </span>
        <button
          onClick={() => window.pi.events.downloadUpdate()}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
        >
          Download
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-text-faint hover:text-text"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
