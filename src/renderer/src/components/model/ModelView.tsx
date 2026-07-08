import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "../../store/useAppStore";

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  reasoning?: boolean;
  contextWindow?: number;
}

interface CustomModelsData {
  providers: Record<string, { baseUrl?: string; api?: string; models: any[] }>;
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"];

const API_OPTIONS = [
  { value: "openai-completions", label: "OpenAI Compatible" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "google-generative-ai", label: "Google Generative AI" },
];

/** Identity + current values of a custom model being edited (pre-fills the form). */
interface EditTarget {
  originalProvider: string; // provider key in models.json
  originalModelId: string;
  providerName: string;
  baseUrl: string;
  api: string;
  modelId: string;
  modelName: string;
  reasoning: boolean;
  contextWindow?: number;
}

interface Preset {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  api: string;
  modelId: string;
  modelName: string;
  reasoning: boolean;
  contextWindow?: number;
  /** Pre-filled API key (e.g. a dummy value for local servers that ignore it). */
  apiKey?: string;
  apiKeyPlaceholder: string;
  signupUrl: string;
}

const PRESETS: Preset[] = [
  {
    id: "local",
    label: "Local",
    description: "Ollama / LM Studio / llama.cpp",
    // Generic localhost template — 11434 is Ollama's port; change it for
    // LM Studio (1234), llama.cpp (8080), or your own server.
    baseUrl: "http://localhost:11434/v1",
    api: "openai-completions",
    modelId: "",
    modelName: "",
    reasoning: false,
    apiKey: "local", // local servers ignore the value but a non-empty key registers the provider
    apiKeyPlaceholder: "any value (local servers ignore it)",
    signupUrl: "",
  },
  {
    id: "claude",
    label: "Claude",
    description: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    api: "anthropic-messages",
    modelId: "claude-sonnet-4-20250514",
    modelName: "Claude Sonnet 4",
    reasoning: true,
    apiKeyPlaceholder: "sk-ant-...",
    signupUrl: "https://console.anthropic.com/",
  },
  {
    id: "codex",
    label: "Codex / OpenAI",
    description: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-completions",
    modelId: "o3",
    modelName: "OpenAI o3",
    reasoning: true,
    apiKeyPlaceholder: "sk-...",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "zai",
    label: "Z.ai (GLM)",
    description: "Zhipu AI",
    baseUrl: "https://api.z.ai/api/paas/v4",
    api: "openai-completions",
    modelId: "glm-5.2",
    modelName: "GLM 5.2",
    reasoning: true,
    apiKeyPlaceholder: "your-zai-key",
    signupUrl: "https://z.ai/model-api",
  },
  {
    id: "minimax",
    label: "MiniMax",
    description: "MiniMax M3",
    baseUrl: "https://api.minimax.chat/v1",
    api: "openai-completions",
    modelId: "MiniMax-M3",
    modelName: "MiniMax M3",
    reasoning: false,
    contextWindow: 1000000,
    apiKeyPlaceholder: "your-minimax-key",
    signupUrl: "https://platform.minimax.io/",
  },
  {
    id: "mimo",
    label: "Xiaomi MiMo",
    description: "MiMo V2.5 Pro",
    baseUrl: "https://api.xiaomimimo.com/v1",
    api: "openai-completions",
    modelId: "mimo-v2.5-pro",
    modelName: "MiMo V2.5 Pro",
    reasoning: true,
    apiKeyPlaceholder: "your-mimo-key",
    signupUrl: "https://platform.xiaomimimo.com/",
  },
  {
    id: "grok",
    label: "Grok (xAI)",
    description: "Grok 4",
    baseUrl: "https://api.x.ai/v1",
    api: "openai-completions",
    modelId: "grok-4",
    modelName: "Grok 4",
    reasoning: true,
    apiKeyPlaceholder: "xai-...",
    signupUrl: "https://console.x.ai/",
  },
];

export function ModelView() {
  const piState = useAppStore((s) => s.activeTab.piState);
  const setPiState = (s: any) => {
    const tid = useAppStore.getState().activeTabId;
    if (tid) useAppStore.getState().setTabPiState(tid, s);
  };
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [customData, setCustomData] = useState<CustomModelsData>({ providers: {} });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const refreshModels = useCallback(() => {
    window.pi.api.getAvailableModels({ tabId: useAppStore.getState().activeTabId ?? undefined }).then((res) => setModels(res.models)).catch(() => {});
    window.pi.api.customModelsList().then(setCustomData).catch(() => {});
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  const grouped = groupBy(models, (m) => m.provider);
  const customProviderKeys = Object.keys(customData.providers);
  const totalCustomModels = customProviderKeys.reduce((sum, k) => sum + (customData.providers[k]?.models?.length ?? 0), 0);

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
                const state = await window.pi.api.cycleModel({ tabId: useAppStore.getState().activeTabId ?? undefined });
                setPiState(state as any);
              }}
              className="mt-2 rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted hover:bg-bg-active"
            >
              Cycle model (Cmd+M)
            </button>
          </section>

          {/* Available models */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-text-faint">Available models</h2>
              <button
                onClick={() => {
                  setEditTarget(null); // don't leave an inline edit form open alongside
                  setShowAddForm((v) => !v);
                }}
                className="no-drag rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
              >
                {showAddForm ? "Cancel" : "+ Add Model"}
              </button>
            </div>

            {showAddForm && (
              <AddModelForm
                onDone={() => {
                  setShowAddForm(false);
                  refreshModels();
                }}
              />
            )}

            <div className="mt-3 space-y-3">
              {Object.entries(grouped).map(([provider, ms]) => (
                <div key={provider}>
                  <div className="mb-1 text-xs font-medium text-text-muted">{provider}</div>
                  <div className="space-y-1">
                    {ms.map((m) => (
                      <button
                        key={m.id}
                        onClick={async () => {
                          const state = await window.pi.api.setModel({
                            provider: m.provider,
                            modelId: m.id,
                            tabId: useAppStore.getState().activeTabId ?? undefined,
                          });
                          if (state) setPiState(state as any);
                        }}
                        className={`no-drag flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                          piState.modelId === m.id
                            ? "border-accent/40 bg-accent/10"
                            : "border-border bg-bg-subtle hover:bg-bg-hover"
                        }`}
                      >
                        <span className="text-sm text-text">{m.name}</span>
                        <div className="flex items-center gap-2 text-xs text-text-faint">
                          {m.reasoning && <span className="rounded bg-bg-hover px-1 py-0.5 text-[9px]">reasoning</span>}
                          {m.contextWindow && <span>{(m.contextWindow / 1000)}k ctx</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Custom models management */}
          {totalCustomModels > 0 && (
            <section>
              <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">
                Your custom models ({totalCustomModels})
              </h2>
              <div className="space-y-2">
                {customProviderKeys.map((providerKey) => {
                  const provider = customData.providers[providerKey];
                  return provider.models.map((model: any) => {
                    const isEditing =
                      editTarget?.originalProvider === providerKey &&
                      editTarget?.originalModelId === model.id;
                    return (
                      <div key={`${providerKey}/${model.id}`}>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-bg-subtle px-3 py-2">
                          <div>
                            <span className="text-sm text-text">{model.name || model.id}</span>
                            <span className="ml-2 text-xs text-text-faint">{providerKey}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditTarget(null);
                                  return;
                                }
                                setShowAddForm(false);
                                setEditTarget({
                                  originalProvider: providerKey,
                                  originalModelId: model.id,
                                  providerName: providerKey,
                                  baseUrl: provider.baseUrl ?? "",
                                  api: provider.api ?? "openai-completions",
                                  modelId: model.id,
                                  modelName: model.name ?? "",
                                  reasoning: !!model.reasoning,
                                  contextWindow: model.contextWindow,
                                });
                              }}
                              className="no-drag rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted hover:bg-bg-hover"
                            >
                              {isEditing ? "Close" : "Edit"}
                            </button>
                            <button
                              onClick={async () => {
                                if (isEditing) setEditTarget(null);
                                await window.pi.api.customModelRemove({ provider: providerKey, modelId: model.id });
                                refreshModels();
                              }}
                              className="no-drag rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        {isEditing && (
                          <div className="mt-2">
                            <AddModelForm
                              initial={editTarget}
                              onDone={() => {
                                setEditTarget(null);
                                refreshModels();
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
              <p className="mt-2 text-xs text-text-faint">
                Custom models appear in Available models after creating a new tab or restarting the app.
              </p>
            </section>
          )}

          {/* Thinking level */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Thinking level</h2>
            <div className="flex flex-wrap gap-2">
              {THINKING_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    window.pi.api.setThinkingLevel({ level, tabId: useAppStore.getState().activeTabId ?? undefined });
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

function AddModelForm({ onDone, initial }: { onDone: () => void; initial?: EditTarget }) {
  const isEdit = !!initial;
  const [provider, setProvider] = useState(initial?.providerName ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [api, setApi] = useState(initial?.api ?? "openai-completions");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState(initial?.modelId ?? "");
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [reasoning, setReasoning] = useState(initial?.reasoning ?? false);
  const [contextWindow, setContextWindow] = useState(
    initial?.contextWindow ? String(initial.contextWindow) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    level: "ok" | "warn" | "error";
    msg: string;
    models?: string[];
  } | null>(null);

  const handleTest = async () => {
    if (!baseUrl.trim()) {
      setTestResult({ level: "error", msg: "Enter a Base URL first." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await window.pi.api.testModelConnection({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        modelId: modelId.trim() || undefined,
      });
      if (!r.ok) {
        setTestResult({ level: "error", msg: r.error ?? "Could not reach the server." });
      } else {
        const count = r.models?.length ?? 0;
        const base = `Reachable — ${count} model${count === 1 ? "" : "s"} available`;
        if (modelId.trim() && r.modelFound === false) {
          setTestResult({ level: "warn", msg: `${base}, but "${modelId.trim()}" isn't in the list`, models: r.models });
        } else if (modelId.trim() && r.modelFound) {
          setTestResult({ level: "ok", msg: `${base} — "${modelId.trim()}" found ✓`, models: r.models });
        } else {
          setTestResult({ level: "ok", msg: base, models: r.models });
        }
      }
    } catch (e) {
      setTestResult({ level: "error", msg: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (preset: Preset) => {
    setProvider(preset.label);
    setBaseUrl(preset.baseUrl);
    setApi(preset.api);
    setModelId(preset.modelId);
    setModelName(preset.modelName);
    setReasoning(preset.reasoning);
    setApiKey(preset.apiKey ?? "");
    if (preset.contextWindow) setContextWindow(String(preset.contextWindow));
    setTestResult(null);
  };

  const handleSubmit = async () => {
    if (!provider.trim() || !baseUrl.trim() || !modelId.trim()) {
      setError("Provider, Base URL, and Model ID are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = isEdit
        ? await window.pi.api.customModelEdit({
            originalProvider: initial!.originalProvider,
            originalModelId: initial!.originalModelId,
            provider: provider.trim(),
            baseUrl: baseUrl.trim(),
            api,
            // Blank = keep the existing key (the field starts empty on edit).
            apiKey: apiKey.trim() || undefined,
            modelId: modelId.trim(),
            modelName: modelName.trim() || undefined,
            reasoning,
            contextWindow: contextWindow ? parseInt(contextWindow, 10) : undefined,
          })
        : await window.pi.api.customModelAdd({
            provider: provider.trim(),
            baseUrl: baseUrl.trim(),
            api,
            apiKey: apiKey.trim() || "$API_KEY",
            modelId: modelId.trim(),
            modelName: modelName.trim() || undefined,
            reasoning,
            contextWindow: contextWindow ? parseInt(contextWindow, 10) : undefined,
          });
      if (!result.success) {
        setError(result.error ?? "Failed to save model.");
        setSaving(false);
        return;
      }
      onDone();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <div className="no-drag rounded-lg border border-border bg-bg-subtle px-4 py-4">
      {/* Presets — only when adding; editing starts from the existing values. */}
      {!isEdit && (
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-faint">
            Quick presets
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-text"
                title={p.signupUrl}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-3">
        <FormField label="Provider name" required>
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="e.g. Claude, Ollama, My Proxy"
            className="form-input"
          />
        </FormField>

        <FormField label="Base URL" required>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="form-input font-mono text-xs"
          />
        </FormField>

        <FormField label="API type">
          <select
            value={api}
            onChange={(e) => setApi(e.target.value)}
            className="form-input"
          >
            {API_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </FormField>

        <FormField
          label="API key"
          hint={isEdit ? "leave blank to keep current" : "Direct key, $ENV_VAR, or !command"}
        >
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={isEdit ? "•••••• (unchanged)" : "sk-... or $MY_API_KEY"}
            className="form-input font-mono text-xs"
          />
        </FormField>

        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="Model ID" required>
              <input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g. llama3.1:8b"
                className="form-input font-mono text-xs"
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="Display name">
              <input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. Llama 3.1 8B"
                className="form-input"
              />
            </FormField>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={reasoning}
              onChange={(e) => setReasoning(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent"
            />
            Reasoning capable
          </label>
          <FormField label="Context window (tokens)">
            <input
              value={contextWindow}
              onChange={(e) => setContextWindow(e.target.value)}
              placeholder="128000"
              className="form-input w-32 font-mono text-xs"
            />
          </FormField>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-danger">{error}</p>
      )}

      {testResult && (
        <div className="mt-3">
          <p
            className={`text-xs ${
              testResult.level === "ok"
                ? "text-success"
                : testResult.level === "warn"
                  ? "text-warning"
                  : "text-danger"
            }`}
          >
            {testResult.msg}
          </p>
          {testResult.models && testResult.models.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-text-faint">
                Available on this server — click to use
              </div>
              <div className="flex flex-wrap gap-1.5">
                {testResult.models.map((id) => {
                  const selected = id === modelId.trim();
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setModelId(id);
                        setTestResult((prev) =>
                          prev ? { ...prev, level: "ok", msg: `Selected "${id}" ✓` } : prev,
                        );
                      }}
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                        selected
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-border bg-bg text-text-muted hover:border-accent/40 hover:text-text"
                      }`}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? "Saving..." : isEdit ? "Save changes" : "Add model"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !baseUrl.trim()}
          title="Ping the Base URL to check the server is reachable"
          className="rounded-lg border border-border bg-bg px-4 py-2 text-xs text-text-muted hover:bg-bg-hover disabled:opacity-40"
        >
          {testing ? "Testing..." : "Test connection"}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-border bg-bg px-4 py-2 text-xs text-text-muted hover:bg-bg-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-text-faint">
        {label}
        {required && <span className="text-danger">*</span>}
        {hint && <span className="font-normal text-text-faint/60">({hint})</span>}
      </label>
      {children}
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
