import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { GitRepoBadge } from "./GitRepoBadge";
import { ExtensionStatusBadges } from "./extensions/ExtensionUi";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  reasoning?: boolean;
  contextWindow?: number;
}

export function StatusBar() {
  const piState = useAppStore((s) => s.activeTab.piState);
  const setPiState = (s: any) => {
    const tid = useAppStore.getState().activeTabId;
    if (tid) useAppStore.getState().setTabPiState(tid, s);
  };
  const queue = useAppStore((s) => s.activeTab.queue);
  const diagnostics = useAppStore((s) => s.diagnostics);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const [thinkOpen, setThinkOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const thinkRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const pendingCount = queue.steering.length + queue.followUp.length;
  const lastDiag = diagnostics[diagnostics.length - 1];
  const currentLevel = piState.thinkingLevel ?? "off";

  // Fetch models when the model menu opens.
  useEffect(() => {
    if (!modelOpen) return;
    window.pi.api.getAvailableModels({ tabId: useAppStore.getState().activeTabId ?? undefined }).then((res) => setModels(res.models)).catch(() => {});
  }, [modelOpen]);

  const handleSetLevel = (level: string) => {
    window.pi.api.setThinkingLevel({ level, tabId: useAppStore.getState().activeTabId ?? undefined });
    setPiState({ thinkingLevel: level });
    setThinkOpen(false);
  };

  const handleSetModel = (m: ModelInfo) => {
    window.pi.api.setModel({ provider: m.provider, modelId: m.id, tabId: useAppStore.getState().activeTabId ?? undefined });
    setPiState({ modelId: m.id, modelName: m.name, provider: m.provider });
    setModelOpen(false);
  };

  // Group models by provider for display.
  const grouped = models.reduce((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  // Close menus on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (thinkRef.current && !thinkRef.current.contains(e.target as Node)) setThinkOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Cmd+M opens model picker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "m") {
        e.preventDefault();
        setModelOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <footer className="no-drag flex h-7 items-center justify-between border-t border-border bg-bg-subtle/50 px-4 text-xs text-text-muted backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {piState.isStreaming ? (
          <span className="flex items-center gap-1.5 text-accent">
            <span className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-accent" />
            Streaming
          </span>
        ) : (
          <span className="text-[11px] text-text-faint">
            Pi Coding Agent v{window.pi?.versions?.pi ?? "0.79.10"}
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-warning">{pendingCount} queued</span>
        )}
        <ExtensionStatusBadges />
        <GitRepoBadge cwd={piState.cwd} tabId={activeTabId ?? undefined} />
      </div>

      <div className="flex items-center gap-3">
        {/* Model picker */}
        <div ref={modelRef} className="relative">
          <span
            onClick={() => {
              setModelOpen((o) => !o);
              setThinkOpen(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setModelOpen((o) => !o);
              setThinkOpen(false);
            }}
            className="cursor-default select-none rounded px-1 py-0.5 text-accent transition-colors hover:bg-bg-hover"
            title="Click or press Cmd+M to change model"
          >
            {piState.modelName || "No model"}
          </span>
          {piState.contextTokens != null && piState.contextWindow != null && (
            <span className="text-[10px] text-text font-medium" title="Context window usage">
              {formatTokens(piState.contextTokens)}/{formatTokens(piState.contextWindow)}
              {(() => {
                const pct = piState.contextWindow > 0 ? (piState.contextTokens / piState.contextWindow) * 100 : 0;
                if (pct > 80) return <span className="ml-1 text-warning">{Math.round(pct)}%</span>;
                return <span className="ml-1">{Math.round(pct)}%</span>;
              })()}
            </span>
          )}
          {piState.totalCost != null && piState.totalCost > 0 && (
            <span className="ml-2 text-[10px] text-success font-medium" title="Total session cost">
              ${piState.totalCost.toFixed(3)}
            </span>
          )}
          {modelOpen && (
            <div className="absolute bottom-7 right-0 z-50 max-h-[400px] min-w-[260px] overflow-y-auto rounded-lg border border-border bg-bg-active py-1 shadow-2xl">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-text-faint">
                Models <span className="ml-1 normal-case text-text-faint">(Cmd+M)</span>
              </div>
              {models.length === 0 && (
                <div className="px-3 py-2 text-xs text-text-faint">No models available</div>
              )}
              {Object.entries(grouped).map(([provider, ms]) => (
                <div key={provider}>
                  <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-text-faint">
                    {provider}
                  </div>
                  {ms.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleSetModel(m)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-bg-hover ${
                        piState.modelId === m.id ? "text-accent" : "text-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        {m.reasoning && (
                          <span className="rounded bg-bg-hover px-1 py-0.5 text-[9px] text-text-faint">R</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {m.contextWindow && (
                          <span className="text-[10px] text-text-faint">{(m.contextWindow / 1000)}k</span>
                        )}
                        {piState.modelId === m.id && <span className="text-[10px]">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thinking level picker */}
        <div ref={thinkRef} className="relative">
          <span
            onClick={() => {
              setThinkOpen((o) => !o);
              setModelOpen(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setThinkOpen((o) => !o);
              setModelOpen(false);
            }}
            className="cursor-default select-none rounded px-1 py-0.5 text-thinking transition-colors hover:bg-bg-hover"
            title="Click or right-click to change thinking level"
          >
            think: {currentLevel}
          </span>
          {thinkOpen && (
            <div className="absolute bottom-7 right-0 z-50 min-w-[140px] rounded-lg border border-border bg-bg-active py-1 shadow-2xl">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-text-faint">
                Thinking level
              </div>
              {THINKING_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => handleSetLevel(level)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-bg-hover ${
                    currentLevel === level ? "text-accent" : "text-text-muted"
                  }`}
                >
                  <span>{level}</span>
                  {currentLevel === level && <span className="text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="truncate max-w-xs">{lastDiag}</span>
        <span className="text-text-faint">Pi Desktop</span>
      </div>
    </footer>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
