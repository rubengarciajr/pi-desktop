import { describe, it, expect } from "vitest";
import { slugifyProvider } from "./models";

describe("slugifyProvider", () => {
  it("leaves an already-clean id untouched", () => {
    expect(slugifyProvider("minimax")).toBe("minimax");
    expect(slugifyProvider("xiaomi-mimo")).toBe("xiaomi-mimo");
  });

  it("keeps dots, so z.ai stays z.ai", () => {
    expect(slugifyProvider("z.ai")).toBe("z.ai");
  });

  it("strips the punctuation that prose preset labels carry", () => {
    // These are the exact labels that used to reach models.json verbatim and
    // produce keys like `grok-(xai)` / `codex-/-openai`.
    expect(slugifyProvider("Grok (xAI)")).toBe("grok-xai");
    expect(slugifyProvider("Codex / OpenAI")).toBe("codex-openai");
    expect(slugifyProvider("Z.ai (GLM)")).toBe("z.ai-glm");
  });

  it("lowercases and collapses whitespace", () => {
    expect(slugifyProvider("  Xiaomi   MiMo  ")).toBe("xiaomi-mimo");
  });

  it("never emits leading/trailing or doubled separators", () => {
    expect(slugifyProvider("!!Grok!!")).toBe("grok");
    expect(slugifyProvider("a  &  b")).toBe("a-b");
    expect(slugifyProvider(".hidden.")).toBe("hidden");
  });

  it("returns empty for input with nothing usable, so callers can reject it", () => {
    expect(slugifyProvider("()")).toBe("");
    expect(slugifyProvider("   ")).toBe("");
  });
});
