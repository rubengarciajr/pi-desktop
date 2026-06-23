import { Markdown } from "./Markdown";
import type { ToolResultTemplate } from "../../../../shared/ipc";

/** Walk a dot-path ("details.results.0.title") into an object. */
function getByPath(obj: any, path: string): any {
  if (!path) return obj;
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function toText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** Fill {dot.path} placeholders in a template string from the result object. */
function fillTemplate(template: string, result: any): string {
  return template.replace(/\{([^}]+)\}/g, (_, path) => toText(getByPath(result, path.trim())));
}

/**
 * Renders a tool's result using an extension-supplied declarative template
 * (Tier 2b). The `result` is the raw tool result object; template field/path
 * values are dot-paths into it (commonly into `result.details`).
 */
export function ToolRenderedResult({
  template,
  result,
  source,
}: {
  template: ToolResultTemplate;
  result: any;
  source: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-faint">
        <span>Output</span>
        <span className="normal-case text-text-faint/70">· {source}</span>
      </div>
      <Body template={template} result={result} />
    </div>
  );
}

function Body({ template, result }: { template: ToolResultTemplate; result: any }) {
  switch (template.type) {
    case "markdown": {
      const md = template.path ? toText(getByPath(result, template.path)) : fillTemplate(template.template ?? "", result);
      return md ? <Markdown>{md}</Markdown> : <Empty />;
    }
    case "keyvalue": {
      const rows = template.fields
        .map((f) => ({ label: f.label, value: toText(getByPath(result, f.path)) }))
        .filter((r) => r.value !== "");
      if (rows.length === 0) return <Empty />;
      return (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          {rows.map((r, i) => (
            <div key={i} className="contents">
              <dt className="text-text-faint">{r.label}</dt>
              <dd className="break-words text-text">{r.value}</dd>
            </div>
          ))}
        </dl>
      );
    }
    case "list": {
      const items = asArray(getByPath(result, template.items));
      if (items.length === 0) return <Empty />;
      return (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => {
            const title = template.title ? toText(getByPath(item, template.title)) : "";
            const subtitle = template.subtitle ? toText(getByPath(item, template.subtitle)) : "";
            const body = template.body ? toText(getByPath(item, template.body)) : "";
            return (
              <li key={i} className="rounded border border-border bg-bg px-2.5 py-1.5">
                {title && <div className="text-xs font-medium text-text">{title}</div>}
                {subtitle && <div className="truncate text-[11px] text-text-faint">{subtitle}</div>}
                {body && <div className="mt-0.5 text-[11px] text-text-muted">{body}</div>}
              </li>
            );
          })}
        </ul>
      );
    }
    case "table": {
      const rows = asArray(getByPath(result, template.items));
      if (rows.length === 0) return <Empty />;
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-text-faint">
                {template.columns.map((c, i) => (
                  <th key={i} className="px-2 py-1 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50">
                  {template.columns.map((c, ci) => (
                    <td key={ci} className="px-2 py-1 align-top text-text-muted">{toText(getByPath(row, c.field))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return <Empty />;
  }
}

function Empty() {
  return <div className="text-[11px] text-text-faint">No result to display.</div>;
}
