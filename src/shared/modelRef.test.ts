import { describe, expect, it } from "vitest";
import { decodeModelRef, encodeModelRef } from "./modelRef";

describe("model references", () => {
  it("round-trips model ids containing slashes", () => {
    const encoded = encodeModelRef("openrouter", "anthropic/claude-sonnet-4");
    expect(decodeModelRef(encoded)).toEqual({
      provider: "openrouter",
      modelId: "anthropic/claude-sonnet-4",
    });
  });

  it("returns an empty selection for malformed values", () => {
    expect(decodeModelRef("not-json")).toEqual({ provider: "", modelId: "" });
    expect(decodeModelRef(JSON.stringify(["only-provider"]))).toEqual({
      provider: "",
      modelId: "",
    });
  });
});
