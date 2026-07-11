import { useState, useEffect } from "react";
import type {
  TagTeamConfig,
  TagTeamTeam,
  TagTeamStage,
  TagTeamResult,
} from "../../../../shared/ipc";
import { decodeModelRef, encodeModelRef } from "../../../../shared/modelRef";
import { TagTeamIcon } from "../Icons";

interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

const DEFAULT_CONFIG: TagTeamConfig = {
  teams: [],
};

/**
 * Full-page sidebar view for managing Tag Teams.
 *
 * A Tag Team is a sequential model relay: the starter model builds out the
 * work, then the finalizer model takes over in a new tab and improves it.
 * This is fundamentally different from MOA (Pi Routing), which runs models
 * in parallel.
 */
export function TagTeamView() {
  const [config, setConfig] = useState<TagTeamConfig>(DEFAULT_CONFIG);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [editingTeam, setEditingTeam] = useState<TagTeamTeam | null>(null);

  useEffect(() => {
    window.pi.api
      .getTagTeamConfig()
      .then(setConfig)
      .catch(() => {});
    window.pi.api
      .getAvailableModels({})
      .then((res) => setModels(res.models))
      .catch(() => {});
  }, []);

  const save = (next: TagTeamConfig) => {
    setConfig(next);
    window.pi.api.setTagTeamConfig(next).catch(() => {});
  };

  const createTeam = () => {
    const team: TagTeamTeam = {
      id: `team-${Date.now()}`,
      name: "New Team",
      stages: [
        { provider: "", modelId: "", role: "Starter", handoffPrompt: "" },
        { provider: "", modelId: "", role: "Finalizer" },
      ],
    };
    setEditingTeam(team);
  };

  const saveTeam = (team: TagTeamTeam) => {
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

  return (
    <div className="flex h-full flex-col">
      <div className="drag-region h-14 shrink-0" />
      {/* Header */}
      <div className="no-drag flex items-center justify-between px-6 pb-3">
        <div className="flex items-center gap-2">
          <TagTeamIcon size={18} className="text-accent" />
          <h1 className="text-sm font-semibold text-text">Tag Team</h1>
        </div>
        <button
          onClick={createTeam}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
        >
          + New Team
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Description */}
        <div className="mb-5 max-w-2xl">
          <p className="text-xs leading-relaxed text-text-muted">
            Create teams where models work sequentially. The{" "}
            <span className="text-text">starter</span> builds out your idea, then{" "}
            <span className="text-text">tags</span> the next model, which takes over in a new tab
            and improves the work. Each handoff can carry a custom prompt so the next model knows
            exactly what to do.
          </p>
        </div>

        {/* Teams list */}
        {config.teams.length === 0 ? (
          <div className="flex max-w-md flex-col items-center rounded-xl border border-border bg-bg-subtle px-6 py-12 text-center">
            <TagTeamIcon size={32} className="mb-3 text-text-faint" />
            <p className="text-sm font-medium text-text">No teams configured</p>
            <p className="mt-1 text-xs text-text-muted">
              Create a team to set up a sequential model relay. The starter model builds, the
              finalizer takes over and polishes.
            </p>
            <button
              onClick={createTeam}
              className="mt-4 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
            >
              + Create your first team
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {config.teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                models={models}
                onEdit={() => setEditingTeam(team)}
                onDelete={() => deleteTeam(team.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Team editor modal */}
      {editingTeam && (
        <TeamEditor
          team={editingTeam}
          models={models}
          onSave={saveTeam}
          onCancel={() => setEditingTeam(null)}
        />
      )}
    </div>
  );
}

/**
 * A team card in the list — shows the relay sequence visually:
 * [Model A] → [Model B] → [Model C]
 */
function TeamCard({
  team,
  models,
  onEdit,
  onDelete,
}: {
  team: TagTeamTeam;
  models: ModelOption[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stageNames = team.stages.map(
    (s) =>
      (models.find((m) => m.provider === s.provider && m.id === s.modelId)?.name ?? s.modelId) ||
      "unset",
  );

  return (
    <div className="rounded-xl border border-border bg-bg-hover px-5 py-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text">{team.name}</div>
          {/* Stage sequence */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {team.stages.map((stage, i) => {
              const isSet = !!stage.modelId;
              const name = stageNames[i];
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
                      isSet ? "border-accent/40 bg-accent/10" : "border-border bg-bg-subtle"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold ${isSet ? "text-accent" : "text-text-faint"}`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`text-xs font-medium ${isSet ? "text-text" : "text-text-faint"}`}
                    >
                      {name}
                    </span>
                    {stage.role && (
                      <span className="rounded bg-bg-active px-1 py-0.5 text-[9px] uppercase tracking-wide text-text-faint">
                        {stage.role}
                      </span>
                    )}
                  </div>
                  {i < team.stages.length - 1 && <span className="text-text-faint">→</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onEdit}
            className="rounded-md border border-border bg-bg-subtle px-2.5 py-1 text-[11px] text-text-muted hover:bg-bg-active hover:text-text"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-md border border-border bg-bg-subtle px-2.5 py-1 text-[11px] text-text-faint hover:border-danger hover:text-danger"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The team editor modal — build the relay sequence, set models, roles,
 * handoff prompts, and test the team.
 */
function TeamEditor({
  team,
  models,
  onSave,
  onCancel,
}: {
  team: TagTeamTeam;
  models: ModelOption[];
  onSave: (team: TagTeamTeam) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TagTeamTeam>(team);
  const [testMessage, setTestMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TagTeamResult | null>(null);

  const addStage = () => {
    setDraft({
      ...draft,
      stages: [...draft.stages, { provider: "", modelId: "", role: "", handoffPrompt: "" }],
    });
  };

  const updateStage = (index: number, stage: Partial<TagTeamStage>) => {
    const stages = [...draft.stages];
    stages[index] = { ...stages[index], ...stage };
    setDraft({ ...draft, stages });
  };

  const removeStage = (index: number) => {
    setDraft({ ...draft, stages: draft.stages.filter((_, i) => i !== index) });
  };

  const moveStage = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= draft.stages.length) return;
    const stages = [...draft.stages];
    [stages[index], stages[newIndex]] = [stages[newIndex], stages[index]];
    setDraft({ ...draft, stages });
  };

  const runTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.pi.api.tagTeamTest({ message: testMessage, team: draft });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        teamName: draft.name,
        stages: [{ modelName: "error", error: err?.message ?? String(err) }],
      });
    } finally {
      setTesting(false);
    }
  };

  const canSave =
    draft.name.trim() && draft.stages.length >= 2 && draft.stages.every((s) => s.modelId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-bg-active p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TagTeamIcon size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text">
              {team.name === "New Team" ? "Create Team" : "Edit Team"}
            </h2>
          </div>
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

        <div className="space-y-5">
          {/* Team name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Team name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="form-input"
              placeholder="e.g. Build & Polish"
            />
          </div>

          {/* Stages */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-text-muted">
                Relay stages ({draft.stages.length})
              </label>
              <button
                onClick={addStage}
                className="rounded-md border border-border bg-bg-subtle px-2 py-1 text-[11px] text-text-muted hover:bg-bg-hover"
              >
                + Add stage
              </button>
            </div>
            <p className="mb-3 text-[11px] text-text-faint">
              Models run in order. Stage 1 builds the work, the last stage finalizes. Each stage's
              handoff prompt tells the next model what to do.
            </p>

            <div className="space-y-3">
              {draft.stages.map((stage, i) => {
                const selectedModel = models.find(
                  (m) => m.provider === stage.provider && m.id === stage.modelId,
                );
                const isSet = !!stage.modelId;
                const isLast = i === draft.stages.length - 1;
                return (
                  <div key={i}>
                    <div
                      className={`rounded-lg border p-3 transition-colors ${
                        isSet ? "border-accent/40 bg-accent/5" : "border-border bg-bg-subtle"
                      }`}
                    >
                      {/* Stage header */}
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                              isSet ? "bg-accent text-white" : "bg-bg-active text-text-faint"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="text-xs font-medium text-text-muted">
                            {isLast ? "Finalizer" : i === 0 ? "Starter" : "Stage"}
                          </span>
                        </div>
                        {/* Reorder + remove */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveStage(i, -1)}
                            disabled={i === 0}
                            className="rounded p-0.5 text-text-faint hover:text-text disabled:opacity-20"
                            title="Move up"
                          >
                            <svg
                              width={14}
                              height={14}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveStage(i, 1)}
                            disabled={isLast}
                            className="rounded p-0.5 text-text-faint hover:text-text disabled:opacity-20"
                            title="Move down"
                          >
                            <svg
                              width={14}
                              height={14}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          {draft.stages.length > 2 && (
                            <button
                              onClick={() => removeStage(i)}
                              className="rounded p-0.5 text-text-faint hover:text-danger"
                              title="Remove stage"
                            >
                              <svg
                                width={14}
                                height={14}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Model + role */}
                      <div className="flex items-center gap-2">
                        {isSet && selectedModel && (
                          <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-1 text-[10px] font-semibold uppercase text-accent">
                            {selectedModel.provider}
                          </span>
                        )}
                        <select
                          value={encodeModelRef(stage.provider, stage.modelId)}
                          onChange={(e) => {
                            const { provider, modelId } = decodeModelRef(e.target.value);
                            updateStage(i, { provider, modelId });
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
                          value={stage.role ?? ""}
                          onChange={(e) => updateStage(i, { role: e.target.value || undefined })}
                          className="form-input w-24"
                          placeholder="role"
                        />
                      </div>

                      {/* Handoff prompt (not on last stage) */}
                      {!isLast && (
                        <div className="mt-2">
                          <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-faint">
                            <span>→</span> Handoff prompt (sent to stage {i + 2})
                          </label>
                          <textarea
                            value={stage.handoffPrompt ?? ""}
                            onChange={(e) =>
                              updateStage(i, { handoffPrompt: e.target.value || undefined })
                            }
                            className="form-input min-h-[60px] resize-y text-xs leading-relaxed"
                            placeholder="e.g. Review the code above and improve it. Fix any bugs, optimize performance, and clean up the structure."
                          />
                        </div>
                      )}
                    </div>
                    {/* Arrow between stages */}
                    {!isLast && (
                      <div className="flex justify-center py-1">
                        <span className="text-text-faint">↓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test area */}
          <div className="rounded-lg border border-border bg-bg-subtle p-3">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Test team</label>
            <p className="mb-2 text-[10px] text-text-faint">
              Runs your test prompt through stage 1, then hands off to stage 2 with your prompt.
              Shows each model's output.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="form-input flex-1"
                placeholder="Enter a test prompt…"
                onKeyDown={(e) => e.key === "Enter" && runTest()}
              />
              <button
                onClick={runTest}
                disabled={!testMessage.trim() || testing || !canSave}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {testing ? "Running…" : "Test"}
              </button>
            </div>
            {testResult && (
              <div className="mt-3 space-y-2">
                {testResult.stages.map((s, i) => (
                  <div key={i} className="rounded-md border border-border bg-bg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text">
                        Stage {i + 1}: {s.modelName}
                      </span>
                      {s.role && (
                        <span className="rounded bg-bg-active px-1.5 py-0.5 text-[9px] uppercase text-text-faint">
                          {s.role}
                        </span>
                      )}
                    </div>
                    {s.error ? (
                      <p className="mt-1 text-[11px] text-danger">{s.error}</p>
                    ) : (
                      <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] text-text-muted">
                        {s.output}
                      </pre>
                    )}
                  </div>
                ))}
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
              disabled={!canSave}
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
