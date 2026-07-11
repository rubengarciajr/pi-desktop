import { describe, expect, it } from "vitest";
import { buildHandoffMessage, DEFAULT_HANDOFF_PROMPT, getHandoffPrompt } from "./relay";
import type { TagTeamTeam } from "./types";

const team: TagTeamTeam = {
  id: "team-1",
  name: "Build and polish",
  stages: [
    {
      provider: "first",
      modelId: "builder",
      handoffPrompt: "Check the implementation and fix every defect.",
    },
    { provider: "second", modelId: "reviewer" },
  ],
};

describe("Tag Team relay", () => {
  it("uses the completed stage's handoff prompt", () => {
    expect(getHandoffPrompt(team, 0)).toBe("Check the implementation and fix every defect.");
  });

  it("falls back when the completed stage has no handoff prompt", () => {
    expect(getHandoffPrompt(team, 1)).toBe(DEFAULT_HANDOFF_PROMPT);
  });

  it("includes the previous output and instruction in the next prompt", () => {
    const message = buildHandoffMessage("const answer = 41;", "Correct the answer.", "Builder");
    expect(message).toContain("previous model (Builder)");
    expect(message).toContain("const answer = 41;");
    expect(message).toContain("Correct the answer.");
  });
});
