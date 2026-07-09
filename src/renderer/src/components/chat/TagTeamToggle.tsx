import { useState, useEffect } from "react";
import { useAppStore } from "../../store/useAppStore";
import { TagTeamIcon } from "../Icons";
import type { TagTeamConfig, TagTeamTeam } from "../../../../shared/ipc";

/**
 * The Tag Team toolbar button.
 *
 * Clicking cycles through configured teams: off → team 1 → team 2 → … → off.
 * When a team is active, the button shows the team name and lights up accent.
 * If no teams are configured, the button is disabled with a tooltip directing
 * the user to the Tag Team sidebar view.
 *
 * Unlike Routing (MOA), Tag Team runs models SEQUENTIALLY: the starter builds,
 * then the next model takes over in a new tab.
 */
export function TagTeamToggle() {
  const tagTeamEnabled = useAppStore((s) => s.activeTab.piState.tagTeamEnabled);
  const tagTeamTeamId = useAppStore((s) => s.activeTab.piState.tagTeamTeamId);
  const [config, setConfig] = useState<TagTeamConfig | null>(null);

  // Refresh config when the toggle is interacted with, and on mount.
  useEffect(() => {
    window.pi.api.getTagTeamConfig().then(setConfig).catch(() => {});
  }, [tagTeamEnabled, tagTeamTeamId]);

  const teams = config?.teams ?? [];
  const hasTeams = teams.length > 0;
  const activeTeam = teams.find((t) => t.id === tagTeamTeamId);

  /**
   * Cycle through teams on click: off → team[0] → team[1] → … → off.
   * If only one team exists: off → on → off.
   */
  const cycle = () => {
    if (!hasTeams) return;
    const tabId = useAppStore.getState().activeTabId;
    if (!tabId) return;

    const currentIndex = tagTeamTeamId ? teams.findIndex((t) => t.id === tagTeamTeamId) : -1;
    const nextTeam: TagTeamTeam | null = (() => {
      if (currentIndex === -1 || !tagTeamEnabled) return teams[0]; // off → first team
      if (currentIndex + 1 < teams.length) return teams[currentIndex + 1]; // → next team
      return null; // last team → off
    })();

    if (nextTeam) {
      useAppStore.getState().setTabPiState(tabId, { tagTeamEnabled: true, tagTeamTeamId: nextTeam.id });
      window.pi.api.setChatTagTeam({ tabId, enabled: true, teamId: nextTeam.id }).catch(() => {});
    } else {
      useAppStore.getState().setTabPiState(tabId, { tagTeamEnabled: false, tagTeamTeamId: null });
      window.pi.api.setChatTagTeam({ tabId, enabled: false }).catch(() => {});
    }
  };

  const title = !hasTeams
    ? "Tag Team — configure a team in the Tag Team sidebar"
    : tagTeamEnabled && activeTeam
      ? `Tag Team ON — ${activeTeam.name}. Click to cycle or turn off.`
      : "Tag Team OFF — click to enable sequential model relay";

  return (
    <button
      onClick={cycle}
      disabled={!hasTeams}
      title={title}
      aria-label="Tag Team"
      className={`flex items-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
        tagTeamEnabled && activeTeam ? "px-2.5" : "px-2"
      } ${
        tagTeamEnabled
          ? "border-accent/40 bg-accent/15 text-accent"
          : hasTeams
            ? "border-border bg-bg-subtle text-text-faint hover:text-text-muted"
            : "border-border bg-bg-subtle text-text-faint opacity-40"
      }`}
    >
      <TagTeamIcon size={12} />
      {/* Show only the icon until a team is active; then show its name. */}
      {tagTeamEnabled && activeTeam && <span>{activeTeam.name}</span>}
    </button>
  );
}
