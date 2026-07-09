import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  type TagTeamConfig,
  type TagTeamTeam,
  type TagTeamStage,
  DEFAULT_TAGTEAM_CONFIG,
} from "./types";

// Tag Team config lives in userData — same reliable location as favorites.json
// and moa-teams.json. Survives app restarts and updates.
const TAGTEAM_CONFIG_FILE = join(app.getPath("userData"), "tag-teams.json");

/** Load the Tag Team config from disk, merging with defaults for missing fields. */
export function loadTagTeamConfig(): TagTeamConfig {
  try {
    if (!existsSync(TAGTEAM_CONFIG_FILE)) return { ...DEFAULT_TAGTEAM_CONFIG };
    const parsed = JSON.parse(readFileSync(TAGTEAM_CONFIG_FILE, "utf-8"));
    return {
      teams: Array.isArray(parsed?.teams) ? parsed.teams.filter(isValidTeam) : [],
    };
  } catch {
    return { ...DEFAULT_TAGTEAM_CONFIG };
  }
}

/** Persist the Tag Team config to disk. */
export function saveTagTeamConfig(config: TagTeamConfig): { success: boolean; error?: string } {
  try {
    writeFileSync(TAGTEAM_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Find a team by id. */
export function findTagTeam(config: TagTeamConfig, teamId: string): TagTeamTeam | undefined {
  return config.teams.find((t) => t.id === teamId);
}

// --- Validation helpers ---

function isValidTeam(t: any): t is TagTeamTeam {
  return (
    t &&
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    Array.isArray(t.stages) &&
    t.stages.length >= 1 &&
    t.stages.every(isValidStage)
  );
}

function isValidStage(s: any): s is TagTeamStage {
  return (
    s &&
    typeof s.provider === "string" &&
    typeof s.modelId === "string"
  );
}
