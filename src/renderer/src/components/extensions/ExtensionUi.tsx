/**
 * ExtensionUi — renders UI driven by Pi extensions through the extension UI
 * bridge: status badges (footer), widgets (banner above the input), blocking
 * dialogs (select/confirm/input/editor), and toast notifications.
 *
 * Every extension gets a polished generic "stock" look for free. Specific
 * extensions can be given a custom on-brand treatment (plan mode below); add
 * more by branching on the status/widget key.
 */
import { useEffect, useRef, useState } from "react";
import { useAppStore, type ExtDialogRequest, type ExtWidget } from "../../store/useAppStore";

/** Extensions whose keys contain "plan" get the dedicated Plan-mode styling. */
function isPlanKey(key: string): boolean {
  return key.toLowerCase().includes("plan");
}

function humanizeKey(key: string): string {
  return key
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Status badges (rendered inside the StatusBar)
// ---------------------------------------------------------------------------

export function ExtensionStatusBadges() {
  const statuses = useAppStore((s) => s.activeTab.extStatuses);
  const entries = Object.entries(statuses);
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([key, text]) => (
        <StatusBadge key={key} statusKey={key} text={text} />
      ))}
    </>
  );
}

function StatusBadge({ statusKey, text }: { statusKey: string; text: string }) {
  const plan = isPlanKey(statusKey);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium animate-fade-in ${
        plan
          ? "border-accent/40 bg-accent-subtle text-accent"
          : "border-border bg-bg-subtle text-text-muted"
      }`}
      title={`${humanizeKey(statusKey)}: ${text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${plan ? "bg-accent animate-pulse-subtle" : "bg-text-faint"}`}
      />
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Widgets (banner cards above the prompt input)
// ---------------------------------------------------------------------------

export function ExtensionWidgets() {
  const widgets = useAppStore((s) => s.activeTab.extWidgets);
  const entries = Object.entries(widgets);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 px-6 pb-2">
      {entries.map(([key, widget]) => (
        <WidgetCard key={key} widgetKey={key} widget={widget} />
      ))}
    </div>
  );
}

function WidgetCard({ widgetKey, widget }: { widgetKey: string; widget: ExtWidget }) {
  const lines = widget.lines.filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  if (isPlanKey(widgetKey)) {
    return <PlanWidget lines={lines} />;
  }
  return <StockWidget widgetKey={widgetKey} lines={lines} />;
}

/** On-brand Plan-mode banner (custom look). */
function PlanWidget({ lines }: { lines: string[] }) {
  const ready = lines.some((l) => /ready/i.test(l));
  return (
    <div className="animate-slide-up overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-b from-accent-subtle to-transparent">
      <div className="flex items-center gap-2 border-b border-accent/15 px-4 py-2">
        <ClipboardIcon className="text-accent" />
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">Plan Mode</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-subtle" />
          {ready ? "plan ready" : "read-only · planning"}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-4 py-2.5">
        {lines.map((line, i) => (
          <div key={i} className={`text-xs ${i === 0 ? "font-medium text-text" : "text-text-muted"}`}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic stock banner for any extension. */
function StockWidget({ widgetKey, lines }: { widgetKey: string; lines: string[] }) {
  return (
    <div className="animate-slide-up rounded-xl border border-border bg-bg-subtle/60 px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <PuzzleIcon className="text-text-faint" />
        <span className="text-xs font-semibold text-text-muted">{humanizeKey(widgetKey)}</span>
        <span className="ml-auto rounded bg-bg px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-faint">
          extension
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {lines.map((line, i) => (
          <div key={i} className="text-xs text-text-muted">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocking dialog (select / confirm / input / editor)
// ---------------------------------------------------------------------------

export function ExtensionDialog() {
  const dialog = useAppStore((s) => s.extDialog);
  const clearExtDialog = useAppStore((s) => s.clearExtDialog);
  if (!dialog) return null;

  const respond = (response: any) => {
    window.pi.api
      .respondExtUi({ tabId: dialog.tabId, id: dialog.id, response })
      .catch(() => {});
    clearExtDialog();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border-strong bg-bg-subtle shadow-2xl">
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Extension
            </span>
          </div>
          <h2 className="mt-1 text-sm font-semibold text-text">{dialog.title}</h2>
          {dialog.message && <p className="mt-1 text-xs text-text-muted">{dialog.message}</p>}
        </div>
        <DialogBody dialog={dialog} respond={respond} />
      </div>
    </div>
  );
}

function DialogBody({
  dialog,
  respond,
}: {
  dialog: ExtDialogRequest;
  respond: (response: any) => void;
}) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(dialog.prefill ?? "");
  const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard: Escape cancels everywhere; arrows + Enter drive the selector.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        respond({ cancelled: true });
        return;
      }
      if (dialog.method === "select" && dialog.options) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIndex((i) => Math.min((dialog.options?.length ?? 1) - 1, i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIndex((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          respond({ value: dialog.options?.[index] });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, index, respond]);

  if (dialog.method === "select") {
    return (
      <div className="max-h-[50vh] overflow-y-auto p-2">
        {(dialog.options ?? []).map((opt, i) => (
          <button
            key={i}
            onClick={() => respond({ value: opt })}
            onMouseEnter={() => setIndex(i)}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              i === index ? "bg-accent text-white" : "text-text hover:bg-bg-hover"
            }`}
          >
            <span className={`text-xs ${i === index ? "text-white/70" : "text-text-faint"}`}>
              {i === index ? "→" : " "}
            </span>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (dialog.method === "confirm") {
    return (
      <div className="flex justify-end gap-2 p-4">
        <button
          onClick={() => respond({ confirmed: false })}
          className="rounded-lg border border-border px-4 py-1.5 text-sm text-text-muted hover:bg-bg-hover"
        >
          No
        </button>
        <button
          onClick={() => respond({ confirmed: true })}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Yes
        </button>
      </div>
    );
  }

  // input / editor
  const isEditor = dialog.method === "editor";
  return (
    <div className="p-4">
      {isEditor ? (
        <textarea
          ref={inputRef as any}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={dialog.placeholder}
          rows={6}
          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      ) : (
        <input
          ref={inputRef as any}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={dialog.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              respond({ value: text });
            }
          }}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => respond({ cancelled: true })}
          className="rounded-lg border border-border px-4 py-1.5 text-sm text-text-muted hover:bg-bg-hover"
        >
          Cancel
        </button>
        <button
          onClick={() => respond({ value: text })}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast notifications (ctx.ui.notify)
// ---------------------------------------------------------------------------

export function ExtensionToasts() {
  const toasts = useAppStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-12 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} id={t.id} message={t.message} level={t.level} />
      ))}
    </div>
  );
}

function Toast({
  id,
  message,
  level,
}: {
  id: number;
  message: string;
  level: "info" | "warning" | "error";
}) {
  const dismiss = useAppStore((s) => s.dismissToast);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 4500);
    return () => clearTimeout(timer);
  }, [id, dismiss]);

  const accent =
    level === "error"
      ? "border-danger/40 text-danger"
      : level === "warning"
        ? "border-warning/40 text-warning"
        : "border-accent/40 text-accent";

  return (
    <div
      onClick={() => dismiss(id)}
      className={`pointer-events-auto max-w-sm cursor-pointer rounded-lg border bg-bg-subtle px-3 py-2 text-xs shadow-lg animate-slide-up ${accent}`}
    >
      <span className="text-text-muted">{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ClipboardIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function PuzzleIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path
        d="M14 4a2 2 0 1 0-4 0v1.5a.5.5 0 0 1-.5.5H8a2 2 0 0 0-2 2v1.5a.5.5 0 0 1-.5.5H4a2 2 0 1 0 0 4h1.5a.5.5 0 0 1 .5.5V20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5a.5.5 0 0 1-.5-.5V4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
