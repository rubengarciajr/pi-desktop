import type { TagTeamTeam } from "./types";

export const DEFAULT_HANDOFF_PROMPT = "Review and improve the work above.";

/** The stage that just finished owns the instructions sent to the next stage. */
export function getHandoffPrompt(team: TagTeamTeam, fromStage: number): string {
  return team.stages[fromStage]?.handoffPrompt?.trim() || DEFAULT_HANDOFF_PROMPT;
}

export function buildHandoffMessage(
  previousOutput: string,
  handoffPrompt: string,
  previousModelName?: string,
): string {
  const source = previousModelName
    ? `The previous model (${previousModelName}) produced the following work:`
    : "A previous model produced the following work:";
  return [
    source,
    "",
    "----- BEGIN PREVIOUS OUTPUT -----",
    previousOutput,
    "----- END PREVIOUS OUTPUT -----",
    "",
    handoffPrompt,
  ].join("\n");
}
