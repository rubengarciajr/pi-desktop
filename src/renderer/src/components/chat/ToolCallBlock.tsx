import { memo, useMemo, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { ToolRenderedResult } from "./ToolRenderer";
import { FilePath, linkifyPaths } from "./FilePath";

/** Tools whose one-line summary IS a file path (so it gets the reveal/copy menu). */
const PATH_TOOLS = new Set(["read", "edit", "write", "ls"]);

export const ToolCallBlock = memo(function ToolCallBlock({ toolCallId }: { toolCallId: string }) {
  const tool = useAppStore((s) => s.activeTab.tools[toolCallId]);
  const renderer = useAppStore((s) => (tool ? s.toolRenderers[tool.toolName] : undefined));

  if (!tool) {
    return (
      <div className="my-1 rounded-lg border border-border bg-bg-subtle/40 px-3 py-1.5 text-xs text-text-muted">
        Tool: {toolCallId}
      </div>
    );
  }

  const icon = TOOL_ICONS[tool.toolName] ?? "🔧";
  const label = tool.toolName;
  const summary = summarizeTool(tool);
  // A successfully-finished result can be shown via an extension's custom
  // renderer; on error or while running we keep the default raw output.
  const result = tool.result ?? tool.partialResult;
  const useCustom = !!renderer && tool.done && !tool.isError && result != null;

  return (
    <details className="my-1 rounded-lg border border-border bg-bg-subtle/40">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs">
        <span>{renderer?.result ? "🧩" : icon}</span>
        <span className="font-medium text-text">{label}</span>
        {tool.done ? (
          tool.isError ? (
            <span className="text-danger">error</span>
          ) : (
            <span className="text-success">done</span>
          )
        ) : (
          <span className="text-accent animate-pulse-subtle">running</span>
        )}
        {summary &&
          (PATH_TOOLS.has(tool.toolName) ? (
            <span className="truncate text-text-faint">
              <FilePath path={summary} variant="inline" />
            </span>
          ) : (
            <span className="truncate text-text-faint">{summary}</span>
          ))}
      </summary>
      <div className="border-t border-border px-3 py-2">
        <ToolArgs tool={tool} />
        {useCustom ? (
          <>
            <ToolRenderedResult template={renderer!.result} result={result} source={renderer!.source} />
            <RawOutputToggle tool={tool} />
          </>
        ) : (
          <ToolOutput tool={tool} />
        )}
      </div>
    </details>
  );
});

/** Lets the user fall back to the raw tool output when a custom renderer is used. */
function RawOutputToggle({ tool }: { tool: any }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setShow((s) => !s)} className="text-[10px] text-text-faint hover:text-text-muted hover:underline">
        {show ? "Hide raw output" : "Show raw output"}
      </button>
      {show && <div className="mt-1"><ToolOutput tool={tool} /></div>}
    </div>
  );
}

const TOOL_ICONS: Record<string, string> = {
  bash: "⚙",
  read: "📖",
  edit: "✏",
  write: "📝",
  grep: "🔍",
  find: "🔎",
  ls: "📁",
};

function summarizeTool(tool: { toolName: string; args: any }): string {
  const a = tool.args ?? {};
  switch (tool.toolName) {
    case "bash":
      return a.command ? `$ ${truncate(a.command, 60)}` : "";
    case "read":
      return a.file_path ?? a.path ?? "";
    case "edit":
      return a.file_path ?? a.path ?? "";
    case "write":
      return a.file_path ?? a.path ?? "";
    case "grep":
      return a.pattern ? `/${a.pattern}/` : "";
    case "find":
      return a.pattern ?? a.path ?? "";
    case "ls":
      return a.path ?? "";
    default:
      return "";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function ToolArgs({ tool }: { tool: any }) {
  const argsText = useMemo(
    () => (tool.args ? JSON.stringify(tool.args, null, 2) : ""),
    [tool.args],
  );
  if (!tool.args) return null;
  return (
    <div className="mb-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-faint">Args</div>
      <pre className="overflow-x-auto rounded bg-bg px-2 py-1.5 text-[11px] text-text-muted font-mono">
        {argsText}
      </pre>
    </div>
  );
}

function ToolOutput({ tool }: { tool: any }) {
  const result = tool.result ?? tool.partialResult;
  if (!result) {
    return tool.done ? null : (
      <div className="text-[11px] text-accent animate-pulse-subtle">Running…</div>
    );
  }
  const text = extractResultText(result);
  const details = result.details;
  const lines = text.split("\n");
  const MAX_LINES = 15;
  const isLong = lines.length > MAX_LINES;
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-faint">Output</div>
      {isLong ? <CollapsibleOutput lines={lines} maxLines={MAX_LINES} /> : (
        <pre className="max-h-64 overflow-auto rounded bg-bg px-2 py-1.5 text-[11px] text-text-muted font-mono whitespace-pre-wrap">
          {linkifyPaths(text)}
        </pre>
      )}
      {details?.diff && (
        <div className="mt-2 text-[11px] text-text-faint">(diff available)</div>
      )}
    </div>
  );
}

function CollapsibleOutput({ lines, maxLines }: { lines: string[]; maxLines: number }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = lines.length - maxLines;

  if (expanded) {
    return (
      <div>
        <pre className="max-h-96 overflow-auto rounded bg-bg px-2 py-1.5 text-[11px] text-text-muted font-mono whitespace-pre-wrap">
          {linkifyPaths(lines.join("\n"))}
        </pre>
        <button
          onClick={() => setExpanded(false)}
          className="mt-1 text-[10px] text-accent hover:underline"
        >
          Show less
        </button>
      </div>
    );
  }

  return (
    <div>
      <pre className="max-h-64 overflow-hidden rounded bg-bg px-2 py-1.5 text-[11px] text-text-muted font-mono whitespace-pre-wrap">
        {linkifyPaths(lines.slice(0, maxLines).join("\n"))}
      </pre>
      <button
        onClick={() => setExpanded(true)}
        className="mt-1 flex items-center gap-1.5 text-[10px] text-accent hover:underline"
      >
        <span className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-accent" />
        ... ({hiddenCount} earlier lines, click to expand)
      </button>
    </div>
  );
}

function extractResultText(result: any): string {
  if (typeof result === "string") return result;
  if (result.content && Array.isArray(result.content)) {
    return result.content
      .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
      .join("\n");
  }
  if (result.output) return result.output;
  return JSON.stringify(result, null, 2);
}
