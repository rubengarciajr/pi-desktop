import { describe, expect, it } from "vitest";
import { normalizeMoaScores } from "./engine";

describe("MOA score parsing", () => {
  it("keeps valid scores and clamps them to the supported range", () => {
    expect(
      normalizeMoaScores([
        { member: "alpha", score: 12, reason: "excellent" },
        { member: "beta", score: -2, reason: "weak" },
      ]),
    ).toEqual([
      { member: "alpha", score: 10, reason: "excellent" },
      { member: "beta", score: 0, reason: "weak" },
    ]);
  });

  it("drops malformed score entries", () => {
    expect(
      normalizeMoaScores([{ member: "alpha", score: "7", reason: "wrong type" }, { score: 5 }]),
    ).toBeUndefined();
  });
});
