import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { PiRoutingIcon } from "../Icons";
import type { MoaConfig, MoaTeam } from "../../../../shared/ipc";

/**
 * The Pi Routing toolbar button + team-picker dropdown.
 *
 * When clicked (and teams exist), toggles routing on. If multiple teams are
 * configured, a dropdown lets the user pick which team to use. Right-click
 * always opens the dropdown. When no teams are configured, the button is
 * disabled with a tooltip directing the user to Settings.
 */
export function RoutingToggle() {
  const routingEnabled = useAppStore((s) => s.activeTab.piState.routingEnabled);
  const routingTeamId = useAppStore((s) => s.activeTab.piState.routingTeamId);
  const [config, setConfig] = useState<MoaConfig | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.pi.api.getMoaConfig().then(setConfig).catch(() => {});
  }, []);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [dropdownOpen]);

  const teams = config?.teams ?? [];
  const hasTeams = teams.length > 0;
  const activeTeam = teams.find((t) => t.id === routingTeamId);

  const toggle = () => {
    if (!hasTeams) return;
    const tabId = useAppStore.getState().activeTabId;
    if (!tabId) return;

    if (routingEnabled) {
      // Turn off.
      useAppStore.getState().setTabPiState(tabId, { routingEnabled: false, routingTeamId: null });
      window.pi.api.setChatRouting({ tabId, enabled: false }).catch(() => {});
    } else if (teams.length === 1) {
      // Single team — toggle on directly.
      const team = teams[0];
      useAppStore.getState().setTabPiState(tabId, { routingEnabled: true, routingTeamId: team.id });
      window.pi.api.setChatRouting({ tabId, enabled: true, teamId: team.id }).catch(() => {});
    } else {
      // Multiple teams — open the picker.
      setDropdownOpen(true);
    }
  };

  const selectTeam = (team: MoaTeam) => {
    const tabId = useAppStore.getState().activeTabId;
    if (!tabId) return;
    useAppStore.getState().setTabPiState(tabId, { routingEnabled: true, routingTeamId: team.id });
    window.pi.api.setChatRouting({ tabId, enabled: true, teamId: team.id }).catch(() => {});
    setDropdownOpen(false);
  };

  const title = !hasTeams
    ? "Pi Routing — configure a team in Settings → Mixture of Agents"
    : routingEnabled
      ? `Pi Routing ON — Team: ${activeTeam?.name ?? "Unknown"}`
      : "Pi Routing OFF — click to enable MOA pre-processing";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          if (hasTeams) setDropdownOpen((o) => !o);
        }}
        disabled={!hasTeams}
        title={title}
        aria-label="Pi Routing"
        className={`flex items-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
          routingEnabled && activeTeam ? "px-2.5" : "px-2"
        } ${
          routingEnabled
            ? "border-accent/40 bg-accent/15 text-accent"
            : hasTeams
              ? "border-border bg-bg-subtle text-text-faint hover:text-text-muted"
              : "border-border bg-bg-subtle text-text-faint opacity-40"
        }`}
      >
        <PiRoutingIcon size={12} />
        {/* Show only the icon until a team is active; then show its name. */}
        {routingEnabled && activeTeam && <span>{activeTeam.name}</span>}
      </button>

      {dropdownOpen && hasTeams && (
        <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[200px] rounded-lg border border-border bg-bg-active py-1 shadow-2xl">
          <div className="border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-faint">
            Select a Team
          </div>
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => selectTeam(team)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-bg-hover ${
                routingTeamId === team.id ? "text-accent" : "text-text-muted"
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{team.name}</div>
                <div className="truncate text-[10px] text-text-faint">
                  {team.members.length} model{team.members.length !== 1 ? "s" : ""}
                </div>
              </div>
              {routingTeamId === team.id && <span className="text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
