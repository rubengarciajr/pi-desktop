import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  reasoning?: boolean;
  contextWindow?: number;
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"];

export function ModelView() {
  const piState = useAppStore((s) => s.activeTab.piState);
  const setPiState = (s: any) => {
    const tid = useAppStore.getState().activeTabId;
    if (tid) useAppStore.getState().setTabPiState(tid, s);
  };
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    window.pi.api.getAvailableModels().then((res) => setModels(res.models)).catch(() => {});
  }, []);

  const grouped = groupBy(models, (m) => m.provider);

  return (
    <div className="flex h-full flex-col">
      <div className="drag-region h-14 shrink-0" />
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-6">
          {/* Current model */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Current</h2>
            <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
              <div className="text-sm font-medium text-text">
                {piState.modelName || "—"}
              </div>
              <div className="text-xs text-text-muted">
                {piState.provider}/{piState.modelId}
              </div>
            </div>
            <button
              onClick={async () => {
                const state = await window.pi.api.cycleModel();
                setPiState(state as any);
              }}
              className="mt-2 rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted hover:bg-bg-active"
            >
              Cycle model (⌘P)
            </button>
          </section>

          {/* Model list */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Available models</h2>
            <div className="space-y-3">
              {Object.entries(grouped).map(([provider, ms]) => (
                <div key={provider}>
                  <div className="mb-1 text-xs font-medium text-text-muted">{provider}</div>
                  <div className="space-y-1">
                    {ms.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => window.pi.api.setModel({ provider: m.provider, modelId: m.id })}
                        className={`no-drag flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                          piState.modelId === m.id
                            ? "border-accent/40 bg-accent/10"
                            : "border-border bg-bg-subtle hover:bg-bg-hover"
                        }`}
                      >
                        <span className="text-sm text-text">{m.name}</span>
                        <div className="flex items-center gap-2 text-xs text-text-faint">
                          {m.reasoning && <span>reasoning</span>}
                          {m.contextWindow && <span>{(m.contextWindow / 1000)}k ctx</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Thinking level */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Thinking level</h2>
            <div className="flex flex-wrap gap-2">
              {THINKING_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    window.pi.api.setThinkingLevel({ level });
                    setPiState({ thinkingLevel: level });
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    piState.thinkingLevel === level
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border bg-bg-subtle text-text-muted hover:bg-bg-hover"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
