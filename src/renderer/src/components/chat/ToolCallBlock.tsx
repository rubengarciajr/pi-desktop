import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";

export function ToolCallBlock({ toolCallId }: { toolCallId: string }) {
  const tool = useAppStore((s) => s.activeTab.tools[toolCallId]);

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

  return (
    <details className="my-1 rounded-lg border border-border bg-bg-subtle/40">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs">
        <span>{icon}</span>
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
        {summary && <span className="truncate text-text-faint">{summary}</span>}
      </summary>
      <div className="border-t border-border px-3 py-2">
        <ToolArgs tool={tool} />
        <ToolOutput tool={tool} />
      </div>
    </details>
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
  if (!tool.args) return null;
  return (
    <div className="mb-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-faint">Args</div>
      <pre className="overflow-x-auto rounded bg-bg px-2 py-1.5 text-[11px] text-text-muted font-mono">
        {JSON.stringify(tool.args, null, 2)}
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
          {text}
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
          {lines.join("\n")}
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
        {lines.slice(0, maxLines).join("\n")}
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
