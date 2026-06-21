import { useAppStore } from "../../store/useAppStore";

/**
 * Renders a unified diff (from edit tool's details.patch) with syntax coloring.
 */
export function DiffViewer({ toolCallId }: { toolCallId: string }) {
  const tool = useAppStore((s) => s.activeTab.tools[toolCallId]);

  if (!tool?.result?.details?.patch && !tool?.result?.details?.diff) {
    return null;
  }

  const patch: string = tool.result.details.patch ?? tool.result.details.diff ?? "";
  const filePath: string = tool.args?.file_path ?? tool.args?.path ?? "file";
  const lines = patch.split("\n");

  return (
    <details open className="rounded-lg border border-border bg-bg-subtle/40 overflow-hidden">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs">
        <span className="text-warning">✏</span>
        <span className="font-medium text-text">Diff</span>
        <span className="truncate text-text-faint font-mono">{filePath}</span>
      </summary>
      <div className="border-t border-border overflow-x-auto">
        <pre className="px-3 py-2 text-[11px] font-mono leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={diffLineClass(line)}>
              {line || " "}
            </div>
          ))}
        </pre>
      </div>
    </details>
  );
}

function diffLineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "text-text-faint";
  if (line.startsWith("@@")) return "text-accent bg-accent/5";
  if (line.startsWith("+")) return "text-success bg-success/5";
  if (line.startsWith("-")) return "text-danger bg-danger/5";
  if (line.startsWith("\\")) return "text-text-faint";
  return "text-text-muted";
}
