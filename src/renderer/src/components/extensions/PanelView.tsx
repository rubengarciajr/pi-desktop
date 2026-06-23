import { useState } from "react";
import type { PanelContribution, PanelSection, PiSettingsField } from "../../../../shared/ipc";
import { useAppStore } from "../../store/useAppStore";
import { Markdown } from "../chat/Markdown";
import { SettingField } from "./ExtensionDetail";

/** Renders an extension-contributed declarative panel (Tier 2). */
export function PanelView({ panel }: { panel?: PanelContribution }) {
  if (!panel) {
    return <div className="flex h-full items-center justify-center text-sm text-text-muted">Panel not found.</div>;
  }
  return (
    <div className="flex h-full flex-col">
      <div className="drag-region h-14 shrink-0" />
      <div className="no-drag flex items-center gap-2 px-6 pb-3">
        {panel.icon && <span className="text-base">{panel.icon}</span>}
        <h1 className="text-sm font-semibold text-text">{panel.title}</h1>
        <span className="text-[10px] text-text-faint">· {panel.source}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-5">
          {panel.sections.map((section, i) => (
            <SectionView key={i} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionView({ section }: { section: PanelSection }) {
  if (section.type === "markdown") {
    return (
      <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <Markdown>{section.content}</Markdown>
      </div>
    );
  }
  if (section.type === "list") {
    return (
      <div>
        {section.title && <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">{section.title}</h2>}
        <ul className="space-y-1 rounded-lg border border-border bg-bg-subtle px-4 py-3 text-sm text-text-muted">
          {section.items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-text-faint">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (section.type === "actions") {
    return (
      <div className="flex flex-wrap gap-2">
        {section.actions.map((a, i) => {
          if (a.url) {
            return (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted hover:bg-bg-active hover:text-text"
              >
                {a.label}
              </a>
            );
          }
          return (
            <button
              key={i}
              onClick={() => {
                const tabId = useAppStore.getState().activeTabId ?? undefined;
                const message = a.command ?? a.prompt;
                if (message) window.pi.api.prompt({ message, tabId }).catch(() => {});
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
            >
              {a.label}
            </button>
          );
        })}
      </div>
    );
  }
  // fields
  return <FieldsSection sectionKey={section.key} fields={section.fields} initial={section.values ?? {}} />;
}

function FieldsSection({
  sectionKey,
  fields,
  initial,
}: {
  sectionKey: string;
  fields: PiSettingsField[];
  initial: Record<string, unknown>;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) init[f.key] = f.key in initial ? initial[f.key] : f.default;
    return init;
  });
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await window.pi.packages.setConfig({ key: sectionKey, values: form }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
      <div className="space-y-3">
        {fields.map((f) => (
          <SettingField key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
          Save
        </button>
        {saved && <span className="text-[10px] text-success">Saved.</span>}
      </div>
    </div>
  );
}
