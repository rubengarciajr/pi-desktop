import { useAppStore } from "../../store/useAppStore";

export function QueueChips() {
  const queue = useAppStore((s) => s.activeTab.queue);
  const hasItems = queue.steering.length > 0 || queue.followUp.length > 0;
  if (!hasItems) return null;

  return (
    <div className="no-drag flex flex-wrap gap-2 px-6 pb-2 pt-1">
      {queue.steering.map((msg, i) => (
        <span
          key={`s-${i}`}
          className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent"
        >
          ⤳ {truncate(msg, 40)}
        </span>
      ))}
      {queue.followUp.map((msg, i) => (
        <span
          key={`f-${i}`}
          className="rounded-full border border-thinking/30 bg-thinking/10 px-3 py-1 text-xs text-thinking"
        >
          ⏱ {truncate(msg, 40)}
        </span>
      ))}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
