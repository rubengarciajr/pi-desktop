import { useState, type ReactNode } from "react";

/**
 * Collapses tall stream content to a fixed height with a fade-out and an
 * expand/collapse toggle. Used for the "long boxes" in the chat stream —
 * code blocks, pasted user messages, diffs, and tool args — so scrollback
 * stays compact and anything can still be reviewed in full on demand.
 *
 * Callers decide *whether* content is long (line counts are cheap where the
 * content is produced); ClampBox only handles the presentation.
 */
export function ClampBox({
  label,
  maxHeight = 300,
  fade = true,
  buttonClassName,
  children,
}: {
  /** Toggle text while collapsed, e.g. "Show all 132 lines". */
  label: string;
  /** Collapsed height in px. */
  maxHeight?: number;
  /** Fade the clipped edge into the background (disable over tinted surfaces). */
  fade?: boolean;
  buttonClassName?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className="relative">
        <div style={expanded ? undefined : { maxHeight }} className={expanded ? undefined : "overflow-hidden"}>
          {children}
        </div>
        {!expanded && fade && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-bg" />
        )}
      </div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className={buttonClassName ?? "mt-1 text-[10px] text-accent hover:underline"}
      >
        {expanded ? "Show less" : label}
      </button>
    </div>
  );
}
