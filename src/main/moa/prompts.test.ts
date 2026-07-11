import { describe, expect, it } from "vitest";
import { aggregatorSystemPrompt } from "./prompts";

describe("MOA prompts", () => {
  it("includes the configured advanced confidence threshold", () => {
    const prompt = aggregatorSystemPrompt(true, 8);
    expect(prompt).toContain("A score below 8 means");
    expect(prompt).not.toContain("${threshold}");
  });

  it("omits score instructions in basic mode", () => {
    expect(aggregatorSystemPrompt(false, 8)).not.toContain("<SCORES>");
  });
});
