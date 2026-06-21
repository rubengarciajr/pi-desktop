import { useEffect, useState } from "react";

interface UpdateState {
  status: "idle" | "checking" | "available" | "up-to-date" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    const off = window.pi.events.onUpdate((data: UpdateState) => {
      setState(data);
    });
    return () => { off?.(); };
  }, []);

  if (state.status === "downloaded") {
    return (
      <div className="no-drag fixed bottom-10 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
        <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-bg-active px-4 py-2.5 shadow-2xl">
          <span className="flex h-2 w-2 animate-pulse-subtle rounded-full bg-accent" />
          <span className="text-sm text-text">
            Update ready{state.version ? ` (v${state.version})` : ""}
          </span>
          <button
            onClick={() => window.pi.events.restartForUpdate()}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Restart now
          </button>
          <button
            onClick={() => setState({ status: "idle" })}
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

  if (state.status === "downloading") {
    return (
      <div className="no-drag fixed bottom-10 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-active px-4 py-2.5 shadow-2xl">
          <span className="text-xs text-text-muted">
            Downloading update{state.version ? ` v${state.version}` : ""}...
            {state.percent != null ? ` ${state.percent}%` : ""}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
