import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface FilePathAction {
  label: string;
  onSelect: () => void;
}

/**
 * A small left-click popover menu for a file path, rendered in a portal at the
 * click point. Closes on outside-click, Escape, or scroll (so it never floats
 * detached from the anchor it belongs to).
 */
export function FilePathMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: FilePathAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    // mousedown (not click) so the menu closes before a downstream click fires.
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // capture:true so scrolls in any nested container (the message list) close it.
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  // Flip/clamp so the menu stays fully inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + r.width > window.innerWidth - 8) nx = window.innerWidth - r.width - 8;
    if (y + r.height > window.innerHeight - 8) ny = y - r.height;
    setPos({ x: Math.max(8, nx), y: Math.max(8, ny) });
  }, [x, y]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[100] min-w-[180px] rounded-lg border border-border bg-bg-active py-1 shadow-2xl animate-fade-in"
      style={{ left: pos.x, top: pos.y }}
    >
      {actions.map((a) => (
        <button
          key={a.label}
          role="menuitem"
          onClick={() => {
            a.onSelect();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
        >
          {a.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
