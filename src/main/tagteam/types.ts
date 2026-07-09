/**
 * Type definitions for the Tag Team feature.
 *
 * Tag Team is a SEQUENTIAL model relay: Model A (the starter) builds out the
 * work, then Model B (the finalizer) takes over in a new tab and improves it.
 * Each stage has its own model + a handoff prompt that tells the next model
 * what to do. This is fundamentally different from MOA (Pi Routing), which
 * runs models in parallel and synthesizes a single briefing.
 */

/**
 * A single stage in a Tag Team relay. Stages run in order: stage 0 is the
 * starter (does the heavy lifting), the last stage is the finalizer.
 */
export interface TagTeamStage {
  /** Model provider key, e.g. "minimax", "openai". */
  provider: string;
  /** Model id within that provider, e.g. "minimax-m3". */
  modelId: string;
  /**
   * Optional role label shown in the UI: "Starter", "Builder", "Reviewer",
   * "Finalizer". Helps the user understand the relay order at a glance.
   */
  role?: string;
  /**
   * The prompt sent to the NEXT model after this stage finishes. Tells the
   * next model what to do with the previous output. Unused on the last stage.
   * The previous model's output is automatically included as context.
   */
  handoffPrompt?: string;
}

/** A team of models that relay sequentially. */
export interface TagTeamTeam {
  /** Unique id (timestamp-based). */
  id: string;
  /** Display name, e.g. "Build & Polish". */
  name: string;
  /** Ordered list of stages. Must have ≥2 (a starter + a finalizer). */
  stages: TagTeamStage[];
}

/** Top-level persisted config. */
export interface TagTeamConfig {
  teams: TagTeamTeam[];
}

/** The result returned by the Tag Team test runner. */
export interface TagTeamResult {
  /** The team that produced this result. */
  teamName: string;
  /** Per-stage outputs. */
  stages: TagTeamStageResult[];
}

/** A single stage's output in a test run. */
export interface TagTeamStageResult {
  /** Display name of the model that ran this stage. */
  modelName: string;
  /** Role label, if set. */
  role?: string;
  /** The stage's output text. */
  output?: string;
  /** Error message if this stage failed. */
  error?: string;
}

/**
 * Event emitted when a Tag Team handoff occurs — Model A finished and a new
 * tab was created for Model B. Forwarded to the renderer via EXT_UI_EVENT.
 */
export interface TagTeamHandoffEvent {
  type: "tagteam:handoff";
  /** The tab where Model A ran. */
  fromTabId: string;
  /** The new tab created for Model B. */
  toTabId: string;
  /** Display name of the model that just finished. */
  fromModel: string;
  /** Display name of the model taking over. */
  toModel: string;
  /** The team name. */
  teamName: string;
  /** Stage index that just finished (0-based). */
  fromStage: number;
  /** Stage index now starting (0-based). */
  toStage: number;
}

/** Default config when no file exists. */
export const DEFAULT_TAGTEAM_CONFIG: TagTeamConfig = {
  teams: [],
};
