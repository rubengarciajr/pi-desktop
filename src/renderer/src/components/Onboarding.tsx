import { useState, useEffect } from "react";
import { PiLogoIcon } from "./Icons";

interface InstallProgress {
  stage: string;
  message: string;
  percent: number;
}

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"checking" | "installing" | "done" | "error">("checking");
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const status = await window.pi.api.checkPiInstalled();
      if (cancelled) return;

      if (status.installed) {
        setPhase("done");
        setTimeout(() => onComplete(), 1500);
      } else {
        setPhase("installing");
        // Subscribe to progress events
        const offProgress = window.pi.events.onInstallProgress((p: InstallProgress) => {
          if (cancelled) return;
          setProgress(p);
          if (p.stage === "done") {
            setPhase("done");
            setTimeout(() => onComplete(), 2000);
          } else if (p.stage === "error") {
            setPhase("error");
            setError(p.message);
          }
        });

        // Start installation
        await window.pi.api.startPiInstall();

        return () => { offProgress(); };
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg">
      {/* Animated logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative">
          <div
            className={`absolute inset-0 rounded-full blur-2xl transition-opacity duration-1000 ${
              phase === "installing" ? "animate-pulse-subtle bg-accent opacity-30" : "bg-accent opacity-10"
            }`}
            style={{ width: 80, height: 80 }}
          />
          <PiLogoIcon size={64} className="relative" />
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-text">Pi Desktop</h1>
        <p className="mt-1 text-sm text-text-faint">
          {phase === "checking" && "Initializing..."}
          {phase === "installing" && "Setting up your environment"}
          {phase === "done" && "Ready to go!"}
          {phase === "error" && "Installation failed"}
        </p>
      </div>

      {/* Progress bar */}
      {phase === "installing" && (
        <div className="w-80">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {progress?.message || "Preparing..."}
            </span>
            <span className="text-xs font-mono text-text-faint">
              {progress?.percent ?? 0}%
            </span>
          </div>
          {/* Step indicators */}
          <div className="mt-6 flex justify-between">
            <Step active={(progress?.percent ?? 0) >= 0} done={(progress?.percent ?? 0) > 20} label="Check" />
            <Step active={(progress?.percent ?? 0) >= 20} done={(progress?.percent ?? 0) > 40} label="Resolve" />
            <Step active={(progress?.percent ?? 0) >= 40} done={(progress?.percent ?? 0) > 80} label="Install" />
            <Step active={(progress?.percent ?? 0) >= 80} done={(progress?.percent ?? 0) >= 100} label="Verify" />
          </div>
        </div>
      )}

      {/* Success animation */}
      {phase === "done" && (
        <div className="flex items-center gap-2 text-accent">
          <CheckCircleIcon size={20} />
          <span className="text-sm font-medium">Pi CLI installed successfully</span>
        </div>
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="flex w-80 flex-col items-center">
          <div className="mb-3 flex items-center gap-2 text-danger">
            <AlertCircleIcon size={20} />
            <span className="text-sm font-medium">Installation Error</span>
          </div>
          <p className="mb-4 text-center text-xs text-text-faint">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setPhase("checking");
              window.location.reload();
            }}
            className="rounded-lg border border-border bg-bg-hover px-4 py-2 text-xs text-text-muted hover:bg-bg-active"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
          done
            ? "border-accent bg-accent"
            : active
            ? "border-accent"
            : "border-border"
        }`}
      >
        {done && (
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {active && !done && (
          <div className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-accent" />
        )}
      </div>
      <span className={`text-[10px] ${active ? "text-text-muted" : "text-text-faint"}`}>{label}</span>
    </div>
  );
}

function CheckCircleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertCircleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
