import { Fragment, type ReactNode, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import {
  basename,
  resolveAbsolute,
  toRelative,
  segmentTextByPaths,
} from "../../../../shared/filePath";
import { FilePathMenu, type FilePathAction } from "./FilePathMenu";

type Variant = "chip" | "inline";

/**
 * A path token that opens a left-click menu (Reveal in Finder / Copy path /
 * filename / relative path). `chip` matches the accent inline-code style used in
 * markdown; `inline` is a subtle underline for use inside monospace output.
 */
export function FilePath({ path, variant = "chip" }: { path: string; variant?: Variant }) {
  // Resolve against the active tab's working folder so relative paths and
  // "Copy relative path" behave correctly.
  const cwd = useAppStore((s) => s.activeTab.piState.cwd ?? s.activeTab.cwd);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const actions: FilePathAction[] = [
    {
      label: "Reveal in Finder",
      onSelect: () => window.pi.api.revealPath({ path: resolveAbsolute(path, cwd) }),
    },
    {
      label: "Copy full path",
      onSelect: () => navigator.clipboard.writeText(resolveAbsolute(path, cwd)),
    },
    {
      label: "Copy filename",
      onSelect: () => navigator.clipboard.writeText(basename(path)),
    },
    {
      label: "Copy relative path",
      onSelect: () => navigator.clipboard.writeText(toRelative(path, cwd)),
    },
  ];

  const base =
    variant === "chip"
      ? "rounded bg-bg-hover px-1 py-0.5 text-[12px] font-mono text-accent break-words hover:bg-bg-active"
      : "text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent";

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        title={`${resolveAbsolute(path, cwd)} — click for options`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setMenu({ x: r.left, y: r.bottom });
          }
        }}
        className={`cursor-pointer ${base}`}
      >
        {path}
      </span>
      {menu && (
        <FilePathMenu x={menu.x} y={menu.y} actions={actions} onClose={() => setMenu(null)} />
      )}
    </>
  );
}

/**
 * Wrap the path-like tokens in a run of free text with interactive <FilePath>
 * spans, leaving all other text untouched. Returns the raw string unchanged when
 * there's nothing to linkify (the common case), so non-path text stays cheap.
 */
export function linkifyPaths(text: string): ReactNode {
  const segments = segmentTextByPaths(text);
  if (!segments.some((s) => s.isPath)) return text;
  return segments.map((seg, i) =>
    seg.isPath ? (
      <FilePath key={i} path={seg.value} variant="inline" />
    ) : (
      <Fragment key={i}>{seg.value}</Fragment>
    ),
  );
}
