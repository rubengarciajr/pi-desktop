import { useState } from "react";
import { PiRoutingIcon } from "../Icons";

interface MoaMemberResponse {
  modelName: string;
  role?: string;
  response?: string;
  error?: string;
  score?: number;
}

/**
 * Post-completion report card for Pi Routing (MOA). Shows each team member's
 * response, score, and the synthesized briefing. Collapsible per-member.
 *
 * Rendered in the chat when a `moa:result` event arrives — gives the user full
 * visibility into what each agent contributed.
 */
export function MoaReportCard({
  teamName,
  briefing,
  teamResponses,
  layers,
  confidence,
}: {
  teamName: string;
  briefing: string;
  teamResponses: MoaMemberResponse[];
  layers: number;
  confidence: number | null;
}) {
  const [expandedMembers, setExpandedMembers] = useState<Set<number>>(new Set());
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  const toggleMember = (i: number) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedMembers(new Set());
      setBriefingExpanded(false);
      setAllExpanded(false);
    } else {
      setExpandedMembers(new Set(teamResponses.map((_, i) => i)));
      setBriefingExpanded(true);
      setAllExpanded(true);
    }
  };

  return (
    <div className="my-2 rounded-xl border border-accent/30 bg-accent/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-accent/20">
        <div className="flex items-center gap-2">
          <PiRoutingIcon size={14} className="text-accent" />
          <span className="text-xs font-semibold text-text">Pi Routing — {teamName}</span>
        </div>
        <div className="flex items-center gap-2">
          {confidence != null && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              confidence >= 6 ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
            }`}>
              {confidence}/10
            </span>
          )}
          {layers > 1 && (
            <span className="rounded-full bg-bg-hover px-2 py-0.5 text-[10px] text-text-muted">
              {layers} layers
            </span>
          )}
          <button
            onClick={toggleAll}
            className="text-[10px] text-accent hover:text-accent-hover"
          >
            {allExpanded ? "Collapse all ▲" : "Expand all ▼"}
          </button>
        </div>
      </div>

      {/* Team member responses */}
      <div className="divide-y divide-border/50">
        {teamResponses.map((member, i) => (
          <div key={i} className="px-4 py-2">
            <button
              onClick={() => toggleMember(i)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[11px] ${member.error ? "text-danger" : "text-success"}`}>
                  {member.error ? "✕" : "✓"}
                </span>
                <span className="text-xs font-medium text-text">{member.modelName}</span>
                {member.role && (
                  <span className="rounded bg-bg-active px-1 py-0.5 text-[9px] uppercase tracking-wide text-text-faint">
                    {member.role}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {member.score != null && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    member.score >= 6 ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                  }`}>
                    {member.score}/10
                  </span>
                )}
                <span className="text-[10px] text-text-faint">
                  {expandedMembers.has(i) ? "▲" : "▼"}
                </span>
              </div>
            </button>
            {expandedMembers.has(i) && (
              <div className="mt-2 rounded-md border border-border bg-bg p-2.5">
                {member.error ? (
                  <p className="text-[11px] text-danger">{member.error}</p>
                ) : (
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-text-muted">
                    {member.response || "(empty response)"}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Briefing */}
      <div className="border-t border-accent/20 px-4 py-2.5">
        <button
          onClick={() => setBriefingExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-[11px] font-semibold text-accent">Briefing</span>
          <span className="text-[10px] text-text-faint">
            {briefingExpanded ? "▲" : "▼"}
          </span>
        </button>
        {briefingExpanded && (
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg p-2.5 text-[11px] leading-relaxed text-text-muted">
            {briefing}
          </pre>
        )}
        {!briefingExpanded && (
          <p className="mt-1 line-clamp-2 text-[11px] text-text-faint">
            {briefing.slice(0, 200)}…
          </p>
        )}
      </div>
    </div>
  );
}
