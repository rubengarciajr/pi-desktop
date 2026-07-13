import { useState, useEffect } from "react";
import type { MoaConfig, MoaTeam, MoaMember, MoaResult } from "../../../../shared/ipc";
import { decodeModelRef, encodeModelRef } from "../../../../shared/modelRef";

interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

const DEFAULT_CONFIG: MoaConfig = {
  teams: [],
  defaultMode: "basic",
  advanced: {
    maxLayers: 3,
    confidenceThreshold: 6,
    showTeamResponses: false,
    allowManualRequery: true,
  },
};

export function MoaPanel() {
  const [config, setConfig] = useState<MoaConfig>(DEFAULT_CONFIG);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [subTab, setSubTab] = useState<"basic" | "advanced">("basic");
  const [editingTeam, setEditingTeam] = useState<MoaTeam | null>(null);
  const [testResult, setTestResult] = useState<MoaResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    window.pi.api
      .getMoaConfig()
      .then(setConfig)
      .catch(() => {});
    window.pi.api
      .getAvailableModels({})
      .then((res) => setModels(res.models))
      .catch(() => {});
  }, []);

  const save = (next: MoaConfig) => {
    setConfig(next);
    window.pi.api.setMoaConfig(next).catch(() => {});
  };

  const createTeam = () => {
    const team: MoaTeam = {
      id: `team-${Date.now()}`,
      name: "New Team",
      members: [],
      aggregatorModel: { provider: "", modelId: "" },
    };
    setEditingTeam(team);
  };

  const saveTeam = (team: MoaTeam) => {
    const existing = config.teams.find((t) => t.id === team.id);
    const teams = existing
      ? config.teams.map((t) => (t.id === team.id ? team : t))
      : [...config.teams, team];
    save({ ...config, teams });
    setEditingTeam(null);
  };

  const deleteTeam = (id: string) => {
    save({ ...config, teams: config.teams.filter((t) => t.id !== id) });
  };

  const runTest = async (team: MoaTeam) => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.pi.api.moaTest({
        message: testMessage,
        team,
      });
      setTestResult(result as MoaResult);
    } catch (err: any) {
      setTestResult({
        briefing: `Error: ${err?.message ?? String(err)}`,
        teamResponses: [],
        layers: 0,
        confidence: null,
        teamName: team.name,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-text">Pi Routing</h2>
        <p className="text-xs text-text-muted">
          Create teams of models that collaborate on your prompts. When Pi Routing is enabled in the
          chat toolbar, each prompt is sent to all team members in parallel, their responses are
          synthesized into a briefing, and the main model builds its answer with the team's analysis
          available.
        </p>
      </div>

      {/* Sub-tab toggle */}
      <div className="flex gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
        <button
          onClick={() => setSubTab("basic")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === "basic" ? "bg-bg-active text-text" : "text-text-faint hover:text-text-muted"
          }`}
        >
          Basic
        </button>
        <button
          onClick={() => setSubTab("advanced")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === "advanced"
              ? "bg-bg-active text-text"
              : "text-text-faint hover:text-text-muted"
          }`}
        >
          Advanced
        </button>
      </div>

      {/* Teams list */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-text-faint">Teams</h3>
          <button
            onClick={createTeam}
            className="rounded-lg bg-accent px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-hover"
          >
            + New Team
          </button>
        </div>

        {config.teams.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-subtle px-4 py-6 text-center">
            <p className="text-xs text-text-muted">No teams configured.</p>
            <p className="mt-1 text-[11px] text-text-faint">
              Click "New Team" to create your first model team.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {config.teams.map((team) => {
              const memberNames = team.members.map(
                (m) =>
                  models.find((mo) => mo.provider === m.provider && mo.id === m.modelId)?.name ??
                  m.modelId,
              );
              return (
                <div
                  key={team.id}
                  className="rounded-lg border border-border bg-bg-hover px-4 py-3 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium text-text">{team.name}</div>
                        {team.mode === "advanced" && (
                          <span className="rounded bg-accent/20 px-1 py-0.5 text-[9px] font-bold uppercase text-accent">Advanced</span>
                        )}
                      </div>
                      {/* Model chips — see the team's makeup at a glance */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {memberNames.map((name, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-bg-active px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
                          >
                            {name}
                          </span>
                        ))}
                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          ⤇{" "}
                          {(models.find(
                            (m) =>
                              m.provider === team.aggregatorModel.provider &&
                              m.id === team.aggregatorModel.modelId,
                          )?.name ??
                            team.aggregatorModel.modelId) ||
                            "no aggregator"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => setEditingTeam(team)}
                        className="rounded-md border border-border bg-bg-subtle px-2 py-1 text-[11px] text-text-muted hover:bg-bg-active hover:text-text"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTeam(team.id)}
                        className="rounded-md border border-border bg-bg-subtle px-2 py-1 text-[11px] text-text-faint hover:text-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Advanced settings */}
      {subTab === "advanced" && (
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-text-faint">
            Advanced Settings
          </h3>
          <div className="space-y-4 rounded-lg border border-border bg-bg-subtle px-4 py-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-text-muted">Max re-query layers</label>
                <span className="text-xs font-medium text-accent">{config.advanced.maxLayers}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={config.advanced.maxLayers}
                onChange={(e) =>
                  save({
                    ...config,
                    advanced: { ...config.advanced, maxLayers: Number(e.target.value) },
                  })
                }
                className="w-full accent-accent"
              />
              <p className="mt-1 text-[10px] text-text-faint">
                How many times the aggregator can re-query low-scoring team members.
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-text-muted">Confidence threshold</label>
                <span className="text-xs font-medium text-accent">
                  {config.advanced.confidenceThreshold}/10
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={config.advanced.confidenceThreshold}
                onChange={(e) =>
                  save({
                    ...config,
                    advanced: { ...config.advanced, confidenceThreshold: Number(e.target.value) },
                  })
                }
                className="w-full accent-accent"
              />
              <p className="mt-1 text-[10px] text-text-faint">
                Minimum score before a team member's response is re-queried.
              </p>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.advanced.showTeamResponses}
                onChange={(e) =>
                  save({
                    ...config,
                    advanced: { ...config.advanced, showTeamResponses: e.target.checked },
                  })
                }
                className="accent-accent"
              />
              <span className="text-xs text-text-muted">
                Show team responses in chat (collapsible)
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.advanced.allowManualRequery}
                onChange={(e) =>
                  save({
                    ...config,
                    advanced: { ...config.advanced, allowManualRequery: e.target.checked },
                  })
                }
                className="accent-accent"
              />
              <span className="text-xs text-text-muted">
                Allow manual re-query button during streaming
              </span>
            </label>

            <div>
              <label className="mb-1 block text-xs text-text-muted">Default mode</label>
              <select
                value={config.defaultMode}
                onChange={(e) =>
                  save({ ...config, defaultMode: e.target.value as "basic" | "advanced" })
                }
                className="form-select"
              >
                <option value="basic">Basic (single pass)</option>
                <option value="advanced">Advanced (score + re-query)</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Team editor modal */}
      {editingTeam && (
        <TeamEditor
          team={editingTeam}
          models={models}
          onSave={saveTeam}
          onCancel={() => setEditingTeam(null)}
          testMessage={testMessage}
          setTestMessage={setTestMessage}
          onTest={runTest}
          testing={testing}
          testResult={testResult}
          confidenceThreshold={config.advanced.confidenceThreshold}
        />
      )}
    </div>
  );
}

function TeamEditor({
  team,
  models,
  onSave,
  onCancel,
  testMessage,
  setTestMessage,
  onTest,
  testing,
  testResult,
  confidenceThreshold,
}: {
  team: MoaTeam;
  models: ModelOption[];
  onSave: (team: MoaTeam) => void;
  onCancel: () => void;
  testMessage: string;
  setTestMessage: (v: string) => void;
  onTest: (team: MoaTeam) => void;
  testing: boolean;
  testResult: MoaResult | null;
  /** Score >= threshold is "good" (green); below is "needs work" (amber). */
  confidenceThreshold: number;
}) {
  const [draft, setDraft] = useState<MoaTeam>(team);

  const addMember = () => {
    setDraft({ ...draft, members: [...draft.members, { provider: "", modelId: "" }] });
  };

  const updateMember = (index: number, member: MoaMember) => {
    const members = [...draft.members];
    members[index] = member;
    setDraft({ ...draft, members });
  };

  const removeMember = (index: number) => {
    setDraft({ ...draft, members: draft.members.filter((_, i) => i !== index) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-bg-active p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Edit Team</h2>
          <button onClick={onCancel} className="text-text-faint hover:text-text">
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Team name */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">Team name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="form-input"
              placeholder="e.g. Team Alpha"
            />
          </div>

          {/* Members */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-text-muted">
                Team members ({draft.members.length})
              </label>
              <button
                onClick={addMember}
                className="rounded-md border border-border bg-bg-subtle px-2 py-1 text-[11px] text-text-muted hover:bg-bg-hover"
              >
                + Add member
              </button>
            </div>
            {draft.members.length === 0 && (
              <p className="text-[11px] text-text-faint">Add at least one model to the team.</p>
            )}
            <div className="space-y-2">
              {draft.members.map((member, i) => {
                const selectedModel = models.find(
                  (m) => m.provider === member.provider && m.id === member.modelId,
                );
                const isSet = !!member.modelId && !!selectedModel;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                      isSet ? "border-accent/40 bg-accent/5" : "border-border bg-bg-subtle"
                    }`}
                  >
                    {/* Provider badge — instant at-a-glance identification */}
                    {isSet && (
                      <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-1 text-[10px] font-semibold uppercase text-accent">
                        {selectedModel!.provider}
                      </span>
                    )}
                    <select
                      value={encodeModelRef(member.provider, member.modelId)}
                      onChange={(e) => {
                        const { provider, modelId } = decodeModelRef(e.target.value);
                        updateMember(i, { ...member, provider, modelId });
                      }}
                      className={`form-select flex-1 ${isSet ? "text-text" : "text-text-faint"}`}
                    >
                      <option value={encodeModelRef("", "")}>Select a model…</option>
                      {models.map((m) => (
                        <option
                          key={`${m.provider}/${m.id}`}
                          value={encodeModelRef(m.provider, m.id)}
                        >
                          {m.name} ({m.provider})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={member.role ?? ""}
                      onChange={(e) =>
                        updateMember(i, { ...member, role: e.target.value || undefined })
                      }
                      className="form-input w-28"
                      placeholder="role"
                    />
                    <button
                      onClick={() => removeMember(i)}
                      className="shrink-0 rounded-md border border-border px-2 py-1.5 text-text-faint hover:border-danger hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aggregator model */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">Aggregator model</label>
            <div
              className={`rounded-lg border p-2 transition-colors ${
                draft.aggregatorModel.modelId
                  ? "border-accent/40 bg-accent/5"
                  : "border-border bg-bg-subtle"
              }`}
            >
              {draft.aggregatorModel.modelId && (
                <span className="mb-1.5 inline-block rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                  {draft.aggregatorModel.provider}
                </span>
              )}
              <select
                value={encodeModelRef(
                  draft.aggregatorModel.provider,
                  draft.aggregatorModel.modelId,
                )}
                onChange={(e) => {
                  const { provider, modelId } = decodeModelRef(e.target.value);
                  setDraft({ ...draft, aggregatorModel: { provider, modelId } });
                }}
                className={`form-select ${draft.aggregatorModel.modelId ? "text-text" : "text-text-faint"}`}
              >
                <option value={encodeModelRef("", "")}>Select an aggregator…</option>
                {models.map((m) => (
                  <option
                    key={`agg-${m.provider}/${m.id}`}
                    value={encodeModelRef(m.provider, m.id)}
                  >
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[10px] text-text-faint">
              The aggregator synthesizes team responses into a briefing for the main model.
            </p>
          </div>

          {/* Mode toggle — Basic vs Advanced */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">Mode</label>
            <div className="flex gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
              <button
                onClick={() => setDraft({ ...draft, mode: "basic" })}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  (draft.mode ?? "basic") === "basic" ? "bg-bg-active text-text" : "text-text-faint hover:text-text-muted"
                }`}
              >
                Basic
              </button>
              <button
                onClick={() => setDraft({ ...draft, mode: "advanced" })}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  draft.mode === "advanced" ? "bg-bg-active text-text" : "text-text-faint hover:text-text-muted"
                }`}
              >
                Advanced
              </button>
            </div>
            <p className="mt-1 text-[10px] text-text-faint">
              {(draft.mode ?? "basic") === "basic"
                ? "Single pass — team members respond once, the aggregator synthesizes a briefing."
                : "Score + re-query — the aggregator scores each response (0–10) and re-queries low-scoring members with feedback for a refined result. Uses the global max layers and threshold settings."}
            </p>
          </div>

          {/* Test area */}
          <div className="rounded-lg border border-border bg-bg-subtle p-3">
            <label className="mb-1 block text-xs font-medium text-text-muted">Test team</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="form-input flex-1"
                placeholder="Enter a test prompt…"
                onKeyDown={(e) => e.key === "Enter" && onTest(draft)}
              />
              <button
                onClick={() => onTest(draft)}
                disabled={
                  !testMessage.trim() ||
                  testing ||
                  draft.members.length === 0 ||
                  !draft.aggregatorModel.modelId
                }
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {testing ? "Running…" : "Test"}
              </button>
            </div>
            {testResult && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent">
                    {testResult.layers} layer{testResult.layers !== 1 ? "s" : ""}
                  </span>
                  {testResult.confidence != null && (
                    <span className="rounded-full bg-bg-hover px-2 py-0.5 text-text-muted">
                      {testResult.confidence}/10 confidence
                    </span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-bg p-2 text-[11px] text-text-muted">
                  <div className="mb-1 font-medium text-text">Briefing</div>
                  <pre className="whitespace-pre-wrap font-sans">{testResult.briefing}</pre>
                </div>
                {testResult.teamResponses.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-text-faint">
                      Team responses
                    </div>
                    {testResult.teamResponses.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-border bg-bg px-2 py-1.5 text-[11px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text">{r.modelName}</span>
                          {r.score != null && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] ${r.score >= confidenceThreshold ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}
                            >
                              {r.score}/10
                            </span>
                          )}
                        </div>
                        {r.error ? (
                          <span className="text-danger">{r.error}</span>
                        ) : (
                          <p className="mt-0.5 truncate text-text-faint">
                            {r.response?.slice(0, 120)}…
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(draft)}
              disabled={
                !draft.name.trim() || draft.members.length === 0 || !draft.aggregatorModel.modelId
              }
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save Team
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
