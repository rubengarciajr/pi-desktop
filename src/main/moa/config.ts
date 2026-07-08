import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  type MoaConfig,
  type MoaTeam,
  type MoaMember,
  DEFAULT_MOA_CONFIG,
} from "./types";

// Pi Routing teams live in userData — same reliable location as favorites.json
// and the GitHub token. Survives app restarts and updates.
const MOA_CONFIG_FILE = join(app.getPath("userData"), "moa-teams.json");

/** Load the MOA config from disk, merging with defaults for missing fields. */
export function loadMoaConfig(): MoaConfig {
  try {
    if (!existsSync(MOA_CONFIG_FILE)) return { ...DEFAULT_MOA_CONFIG };
    const parsed = JSON.parse(readFileSync(MOA_CONFIG_FILE, "utf-8"));
    return {
      teams: Array.isArray(parsed?.teams) ? parsed.teams.filter(isValidTeam) : [],
      defaultMode: parsed?.defaultMode === "advanced" ? "advanced" : "basic",
      advanced: {
        maxLayers: clamp(parsed?.advanced?.maxLayers, 1, 5, DEFAULT_MOA_CONFIG.advanced.maxLayers),
        confidenceThreshold: clamp(parsed?.advanced?.confidenceThreshold, 0, 10, DEFAULT_MOA_CONFIG.advanced.confidenceThreshold),
        showTeamResponses: Boolean(parsed?.advanced?.showTeamResponses),
        allowManualRequery: parsed?.advanced?.allowManualRequery !== false,
      },
    };
  } catch {
    return { ...DEFAULT_MOA_CONFIG };
  }
}

/** Persist the MOA config to disk. */
export function saveMoaConfig(config: MoaConfig): { success: boolean; error?: string } {
  try {
    writeFileSync(MOA_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Find a team by id. */
export function findTeam(config: MoaConfig, teamId: string): MoaTeam | undefined {
  return config.teams.find((t) => t.id === teamId);
}

// --- Validation helpers ---

function isValidTeam(t: any): t is MoaTeam {
  return (
    t &&
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    Array.isArray(t.members) &&
    t.members.every(isValidMember) &&
    t.aggregatorModel &&
    typeof t.aggregatorModel.provider === "string" &&
    typeof t.aggregatorModel.modelId === "string"
  );
}

function isValidMember(m: any): m is MoaMember {
  return (
    m &&
    typeof m.provider === "string" &&
    typeof m.modelId === "string"
  );
}

function clamp(val: any, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
