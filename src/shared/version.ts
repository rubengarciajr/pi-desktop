/** Semantic-ish version comparison shared across main/renderer. */

/**
 * Parse a dot-separated version segment into a number, stripping any
 * pre-release/build suffix (e.g. "0-rc1" → 0, "5-beta" → 5). Non-numeric
 * segments coerce to 0 so `compareVersions` never produces NaN, which would
 * silently mis-rank tagged releases (e.g. "0.5.4-beta" vs "0.5.4").
 */
function parseSegment(seg: string): number {
  // Strip everything from the first non-[0-9] char (handles "-rc1", "+build", etc).
  const n = parseInt(seg.replace(/[^0-9].*$/, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Returns positive if a > b, negative if a < b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(parseSegment);
  const pb = b.split(".").map(parseSegment);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}
