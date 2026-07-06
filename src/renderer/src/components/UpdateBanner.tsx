import { useEffect, useState } from "react";

interface UpdateState {
  status: "idle" | "available" | "up-to-date" | "error";
  version?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  message?: string;
}

type DownloadState =
  | { phase: "idle" }
  | { phase: "downloading"; loaded: number; total: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [download, setDownload] = useState<DownloadState>({ phase: "idle" });
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

  // Listen for download progress events from the main process.
  useEffect(() => {
    if (download.phase !== "downloading") return;
    const off = window.pi.events.onUpdateProgress(({ loaded, total }) => {
      setDownload({ phase: "downloading", loaded, total });
      if (total > 0 && loaded >= total) {
        setDownload({ phase: "ready" });
      }
    });
    return off;
  }, [download.phase]);

  if (state.status !== "available" || dismissed) return null;

  const handleDownload = async () => {
    setDownload({ phase: "downloading", loaded: 0, total: 0 });
    try {
      const res = await window.pi.events.downloadUpdate({ url: state.downloadUrl });
      if (res?.success) {
        setDownload({ phase: "ready" });
      } else {
        setDownload({ phase: "error", message: res?.error ?? "Download failed" });
      }
    } catch (e: any) {
      setDownload({ phase: "error", message: e?.message ?? String(e) });
    }
  };

  const pct = download.phase === "downloading" && download.total > 0
    ? Math.round((download.loaded / download.total) * 100)
    : 0;

  return (
    <div className="no-drag fixed bottom-10 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
      <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-bg-active px-4 py-2.5 shadow-2xl">
        <span className="flex h-2 w-2 animate-pulse-subtle rounded-full bg-accent" />
        {download.phase === "downloading" ? (
          <span className="text-sm text-text">
            Downloading… {pct > 0 ? `${pct}%` : formatBytes(download.loaded)}
          </span>
        ) : download.phase === "ready" ? (
          <span className="text-sm text-text">
            Installer opened — drag Pi Desktop to Applications
          </span>
        ) : download.phase === "error" ? (
          <span className="text-sm text-danger">Update failed — try again</span>
        ) : (
          <span className="text-sm text-text">
            Pi Desktop v{state.version} is available
          </span>
        )}

        {download.phase === "idle" && (
          <button
            onClick={handleDownload}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Download
          </button>
        )}
        {download.phase === "downloading" && (
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {download.phase === "ready" && (
          <button
            onClick={handleDownload}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Reopen installer
          </button>
        )}
        {download.phase === "error" && (
          <button
            onClick={handleDownload}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Retry
          </button>
        )}

        {download.phase === "idle" && (
          <button
            onClick={() => setDismissed(true)}
            className="text-text-faint hover:text-text"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
