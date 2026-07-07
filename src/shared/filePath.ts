/**
 * Pure helpers for recognizing and manipulating filesystem paths that appear in
 * chat text, so the renderer can turn them into interactive "reveal in Finder /
 * copy path" chips. Kept framework-free so it can be unit-tested in node.
 */

/** Trailing characters that commonly cling to a path in prose but aren't part of it. */
const TRAILING_PUNCT = /[)\]}.,;:!?'"]+$/;

/** Strip surrounding punctuation that isn't part of the path (e.g. a trailing period). */
export function cleanPath(token: string): string {
  return token.trim().replace(TRAILING_PUNCT, "");
}

/** The final path segment (file or folder name), with any trailing slash removed. */
export function basename(path: string): string {
  const clean = path.replace(/\/+$/, "");
  const seg = clean.split("/").pop();
  return seg && seg.length > 0 ? seg : clean;
}

/**
 * True when the extension (after the last dot of the final segment) starts with
 * a letter — so `View.tsx` and `RubenchisMD-1.2.2.dmg` count, but version
 * numbers like `0.3.6` or `1.2.2` (numeric last part) do not.
 */
function hasFileExtension(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  const m = base.match(/\.[A-Za-z][A-Za-z0-9]{0,7}$/);
  if (!m) return false;
  return base.length - m[0].length > 0; // must have a stem before the extension
}

/**
 * Best-effort heuristic: does this single token look like a filesystem path?
 * Deliberately conservative to avoid false positives in prose — excludes URLs,
 * dates (`7/7/2026`), fractions (`1/2`), and word pairs like `and/or`.
 */
export function looksLikePath(raw: string): boolean {
  const path = cleanPath(raw);
  if (!path || path.length > 512) return false;
  if (/\s/.test(path)) return false; // we only linkify single, whitespace-free tokens
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return false; // http://, file://, etc.
  if (/^www\./i.test(path)) return false;

  // Absolute, home-relative, or explicitly-relative prefixes are unambiguous.
  if (/^(\/|~\/|\.\/|\.\.\/)/.test(path)) return true;

  if (path.includes("/")) {
    const segments = path.split("/").filter(Boolean);
    if (segments.every((seg) => /^\d+$/.test(seg))) return false; // dates, fractions
    if (hasFileExtension(path)) return true;
    // A bare word pair like `and/or` has one slash; real dir paths have 2+.
    return (path.match(/\//g) || []).length >= 2;
  }

  // Bare filename with a real extension: View.tsx, index.html, favorites.json.
  return hasFileExtension(path);
}

/** Join two POSIX path fragments with exactly one separator. */
function joinPosix(a: string, b: string): string {
  return `${a.replace(/\/+$/, "")}/${b.replace(/^\.?\/+/, "")}`;
}

/**
 * Resolve a path to absolute for OS operations. Absolute and `~/` paths pass
 * through (the main process expands `~`); relative paths are joined onto `cwd`
 * when one is available, otherwise returned unchanged.
 */
export function resolveAbsolute(path: string, cwd?: string): string {
  const p = cleanPath(path);
  if (p.startsWith("/") || p.startsWith("~/")) return p;
  if (cwd) return joinPosix(cwd, p);
  return p;
}

/**
 * Path relative to `cwd`. If the path is outside `cwd` (or there's no `cwd`),
 * falls back to the absolute/original path rather than emitting `../../..`.
 */
export function toRelative(path: string, cwd?: string): string {
  const p = cleanPath(path);
  if (!cwd) return p;
  const abs = resolveAbsolute(p, cwd);
  const base = `${cwd.replace(/\/+$/, "")}/`;
  if (abs === cwd.replace(/\/+$/, "")) return ".";
  if (abs.startsWith(base)) return abs.slice(base.length);
  return abs;
}

export interface TextSegment {
  value: string;
  isPath: boolean;
}

/**
 * Split free text into runs of plain text and path tokens, preserving all
 * original characters (whitespace included) so the joined result is loss-less.
 * Trailing punctuation on a path is kept as plain text, not part of the path.
 */
export function segmentTextByPaths(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Split on whitespace but keep the whitespace runs as their own pieces.
  const pieces = text.split(/(\s+)/);
  for (const piece of pieces) {
    if (piece === "") continue;
    if (/^\s+$/.test(piece)) {
      pushPlain(segments, piece);
      continue;
    }
    const path = cleanPath(piece);
    if (path && looksLikePath(path)) {
      pushPlain(segments, piece.slice(0, piece.indexOf(path)));
      segments.push({ value: path, isPath: true });
      pushPlain(segments, piece.slice(piece.indexOf(path) + path.length));
    } else {
      pushPlain(segments, piece);
    }
  }
  return segments;
}

/** Append plain text, merging with the previous plain run to keep segments tidy. */
function pushPlain(segments: TextSegment[], value: string): void {
  if (!value) return;
  const last = segments[segments.length - 1];
  if (last && !last.isPath) last.value += value;
  else segments.push({ value, isPath: false });
}
