/**
 * Encode provider/model pairs for HTML select values without losing slashes in
 * model ids (for example, OpenRouter's "anthropic/claude-sonnet-4").
 */
export function encodeModelRef(provider: string, modelId: string): string {
  return JSON.stringify([provider, modelId]);
}

export function decodeModelRef(value: string): { provider: string; modelId: string } {
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return { provider: parsed[0], modelId: parsed[1] };
    }
  } catch {
    // Fall through to the empty selection below.
  }
  return { provider: "", modelId: "" };
}
