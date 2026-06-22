import { describe, expect, it } from "vitest";
import { compareVersions } from "./version";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("treats missing trailing parts as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBeGreaterThan(0);
  });

  it("orders by the most significant differing part", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.9.9", "2.0.0")).toBeLessThan(0);
    expect(compareVersions("0.2.10", "0.2.9")).toBeGreaterThan(0);
  });

  it("detects a newer patch release (the update-check use case)", () => {
    expect(compareVersions("0.2.8", "0.2.7")).toBeGreaterThan(0);
    expect(compareVersions("0.2.7", "0.2.8")).toBeLessThan(0);
  });
});
