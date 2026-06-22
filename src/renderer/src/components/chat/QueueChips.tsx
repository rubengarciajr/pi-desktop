import { useAppStore } from "../../store/useAppStore";

export function QueueChips() {
  const queue = useAppStore((s) => s.activeTab.queue);
  const hasItems = queue.steering.length > 0 || queue.followUp.length > 0;
  if (!hasItems) return null;

  const remove = (kind: "steering" | "followUp", index: number) => {
    const tabId = useAppStore.getState().activeTabId ?? undefined;
    window.pi.api.removeQueued({ kind, index, tabId }).catch(() => {});
  };

  return (
    <div className="no-drag flex flex-wrap gap-2 px-6 pb-2 pt-1">
      {queue.steering.map((msg, i) => (
        <QueueChip
          key={`s-${i}`}
          icon="⤳"
          text={truncate(msg, 40)}
          className="border-accent/30 bg-accent/10 text-accent"
          onRemove={() => remove("steering", i)}
        />
      ))}
      {queue.followUp.map((msg, i) => (
        <QueueChip
          key={`f-${i}`}
          icon="⏱"
          text={truncate(msg, 40)}
          className="border-thinking/30 bg-thinking/10 text-thinking"
          onRemove={() => remove("followUp", i)}
        />
      ))}
    </div>
  );
}

function QueueChip({
  icon,
  text,
  className,
  onRemove,
}: {
  icon: string;
  text: string;
  className: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={`group/chip inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-xs ${className}`}
    >
      <span>
        {icon} {text}
      </span>
      <button
        onClick={onRemove}
        title="Remove from queue (keeps the agent running)"
        className="flex h-4 w-4 items-center justify-center rounded-full text-current opacity-50 transition-opacity hover:bg-black/20 hover:opacity-100"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
