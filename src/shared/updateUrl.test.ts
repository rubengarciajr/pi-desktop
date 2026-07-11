import { describe, expect, it } from "vitest";
import { validateGitHubReleaseDmgUrl } from "./updateUrl";

describe("update DMG URL validation", () => {
  it("accepts DMGs from the configured GitHub release path", () => {
    const url =
      "https://github.com/rubengarciajr/pi-desktop/releases/download/v0.5.4/Pi.Desktop.dmg";
    expect(validateGitHubReleaseDmgUrl(url, "rubengarciajr", "pi-desktop")).toBe(url);
  });

  it("rejects other hosts, repositories, and file types", () => {
    expect(() =>
      validateGitHubReleaseDmgUrl(
        "https://example.com/rubengarciajr/pi-desktop/releases/download/v1/app.dmg",
        "rubengarciajr",
        "pi-desktop",
      ),
    ).toThrow();
    expect(() =>
      validateGitHubReleaseDmgUrl(
        "https://github.com/attacker/app/releases/download/v1/app.dmg",
        "rubengarciajr",
        "pi-desktop",
      ),
    ).toThrow();
    expect(() =>
      validateGitHubReleaseDmgUrl(
        "https://github.com/rubengarciajr/pi-desktop/releases/download/v1/app.zip",
        "rubengarciajr",
        "pi-desktop",
      ),
    ).toThrow();
  });
});
