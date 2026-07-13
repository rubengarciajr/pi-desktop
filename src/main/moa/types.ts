/**
 * Type definitions for the Pi Routing (Mixture of Agents) feature.
 * Shared between main process config persistence, the engine, and IPC.
 */

/** A single model that participates in a team. */
export interface MoaMember {
  /** Model provider key, e.g. "anthropic", "openai", "custom-glm". */
  provider: string;
  /** Model id within that provider, e.g. "claude-sonnet-5". */
  modelId: string;
  /** Optional role label for the aggregator prompt, e.g. "architect". */
  role?: string;
}

/** A team of models that collaborates on a pre-processing briefing. */
export interface MoaTeam {
  /** Unique id (uuid or timestamp-based). */
  id: string;
  /** Display name, e.g. "Team Alpha". */
  name: string;
  /** The models that fan out in parallel. Must have ≥1 member. */
  members: MoaMember[];
  /** The model that synthesizes member responses into a briefing. */
  aggregatorModel: { provider: string; modelId: string };
  /** "basic" = single pass (default); "advanced" = score + re-query loop. */
  mode?: "basic" | "advanced";
}

/** Advanced-mode tuning knobs. */
export interface MoaAdvancedConfig {
  /** Max re-query layers (1–5). Default 3. */
  maxLayers: number;
  /** Minimum aggregator confidence (0–10) before re-querying. Default 6. */
  confidenceThreshold: number;
  /** Show each member's response + score in collapsible chat sections. */
  showTeamResponses: boolean;
  /** Show a "Re-query team" button during streaming for manual re-query. */
  allowManualRequery: boolean;
}

/** Top-level persisted config. */
export interface MoaConfig {
  teams: MoaTeam[];
  defaultMode: "basic" | "advanced";
  advanced: MoaAdvancedConfig;
}

/** A single team member's response after fan-out. */
export interface MoaMemberResult {
  provider: string;
  modelId: string;
  modelName: string;
  role?: string;
  /** The response text, or undefined if the member failed. */
  response?: string;
  /** Error message if the member failed. */
  error?: string;
  /** Aggregator-assigned confidence score (0–10). Advanced mode only. */
  score?: number;
}

/** The result returned by the MOA engine. */
export interface MoaResult {
  /** The synthesized briefing injected into the session context. */
  briefing: string;
  /** Each member's response + score. */
  teamResponses: MoaMemberResult[];
  /** How many layers ran (1 = basic single-pass, >1 = advanced re-queries). */
  layers: number;
  /** Average member score in advanced mode; null when the run was not scored. */
  confidence: number | null;
  /** The team that produced this result. */
  teamName: string;
}

/** Progress event emitted during MOA execution. */
export interface MoaProgressEvent {
  phase: "fanning-out" | "member-done" | "aggregating" | "scoring" | "re-querying" | "done" | "error";
  layer: number;
  member?: string;
  progress: number; // 0–100
  message?: string;
}

/** Default config when no file exists. */
export const DEFAULT_MOA_CONFIG: MoaConfig = {
  teams: [],
  defaultMode: "basic",
  advanced: {
    maxLayers: 3,
    confidenceThreshold: 6,
    showTeamResponses: false,
    allowManualRequery: true,
  },
};
