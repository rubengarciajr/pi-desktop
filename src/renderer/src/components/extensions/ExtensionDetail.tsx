import { useEffect, useState } from "react";
import type { ExtensionDetail as Detail, PiSettingsField } from "../../../../shared/ipc";
import { Markdown } from "../chat/Markdown";

/** Per-extension detail panel: docs (README) + a settings form (pi.settings). */
export function ExtensionDetail({ source, onBack }: { source: string; onBack: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.pi.packages
      .detail({ source })
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        if (d.schema) {
          const init: Record<string, unknown> = {};
          for (const f of d.schema.fields) {
            init[f.key] = f.key in d.values ? d.values[f.key] : f.default;
          }
          setForm(init);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [source]);

  const save = async () => {
    if (!detail?.schema) return;
    setSaving(true);
    try {
      await window.pi.packages.setConfig({ key: detail.schema.key, values: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {}
    setSaving(false);
  };

  const meta = detail?.meta;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="no-drag flex items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-muted"
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to extensions
      </button>

      {/* Header */}
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold text-text">{meta?.name ?? source}</h1>
          {meta?.version && <span className="text-xs text-text-faint">v{meta.version}</span>}
        </div>
        {meta?.description && <p className="mt-1 text-sm text-text-muted">{meta.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
          <span className="font-mono text-text-faint">{meta?.source ?? source}</span>
          {meta?.homepage && (
            <a href={meta.homepage} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Homepage
            </a>
          )}
          {meta?.repository && (
            <a href={meta.repository.replace(/^git\+/, "")} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Repository
            </a>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-text-muted">Loading…</div>
      ) : (
        <>
          {/* Settings */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Settings</h2>
            {detail?.schema ? (
              <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
                <div className="space-y-3">
                  {detail.schema.fields.map((f) => (
                    <SettingField key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {saved && <span className="text-[10px] text-success">Saved to settings.json.</span>}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3 text-xs text-text-muted">
                This extension hasn't declared settings. Configure it by editing{" "}
                <span className="font-mono text-text-faint">~/.pi/agent/settings.json</span> as described in its docs below.
              </div>
            )}
          </section>

          {/* Docs */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Documentation</h2>
            <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
              {detail?.readme ? (
                <Markdown>{detail.readme}</Markdown>
              ) : (
                <p className="text-xs text-text-faint">No README found for this package.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function SettingField({
  field,
  value,
  onChange,
}: {
  field: PiSettingsField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-start gap-2 text-xs text-text">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-accent" />
        <span>
          {field.label}
          {field.description && <span className="mt-0.5 block text-[10px] text-text-faint">{field.description}</span>}
        </span>
      </label>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-text">{field.label}</label>
      {field.description && <p className="mb-1 text-[10px] text-text-faint">{field.description}</p>}
      {field.type === "select" ? (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text focus:border-accent/50 focus:outline-none"
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "secret" ? "password" : field.type === "number" ? "number" : "text"}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-mono text-text focus:border-accent/50 focus:outline-none selectable"
        />
      )}
    </div>
  );
}
