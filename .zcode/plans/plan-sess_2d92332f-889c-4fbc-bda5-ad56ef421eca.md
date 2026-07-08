# Pi Routing — Mixture of Agents Feature (v0.4.0)

## What it does

A Pi Desktop exclusive feature. When enabled, the user's prompt is sent to a **team of models** in parallel. Their responses are **aggregated into an enriched briefing**, which is injected into the session context. The main model then builds its response with the team's analysis available — pre-processing, not replacement. The user sees the main model's output, enriched by the team's input.

Two modes:
- **Basic**: MOA runs once per prompt → team responds → aggregator synthesizes → main model builds. One layer.
- **Advanced**: Same as Basic, but the aggregator scores each team response (0–10 confidence). If below a configurable threshold, it automatically re-queries the team with a refined prompt (up to N layers). The user can also manually trigger a re-query, and the confidence score is visible.

## The Pi Routing Icon (dark/light mode)

The existing `resources/pi-routing.svg` has paths with no `fill` attribute (renders as black — invisible on dark backgrounds). I'll inline it as a `PiRoutingIcon` component in `Icons.tsx` with `fill="currentColor"` on all paths. This makes the icon automatically adapt to both dark and light themes via the parent element's text color class — exactly how `PiLogoIcon` and every other icon in the app works. No separate dark/light PNG variants needed.

## Architecture

### New files

```
src/main/moa/
  ├── types.ts          # MoaTeam, MoaMember, MoaConfig, MoaResult types
  ├── config.ts         # Load/save teams to userData/moa-teams.json (favorites.ts pattern)
  ├── engine.ts         # The orchestrator: fan-out → aggregate → score → loop
  └── prompts.ts        # System prompts for team members + aggregator

src/renderer/src/components/settings/
  └── MoaPanel.tsx      # Settings panel with Basic/Advanced sub-tabs

src/renderer/src/components/chat/
  └── RoutingToggle.tsx  # Toolbar button + team-picker dropdown
```

### Modified files

| File | Change |
|---|---|
| `src/main/ipc.ts` | Register `pi:moa.get`, `pi:moa.set`, `pi:moa.run` handlers |
| `src/main/pi/PiSessionManager.ts` | Add `routingEnabled` field, `setRoutingEnabled()`, `routingTeamId` field; override `prompt()` to run MOA first when enabled, inject briefing via `appendCustomMessageEntry` (same pattern as `injectWebNudge`), then call `session.prompt()` |
| `src/preload/index.ts` | Expose `getMoaConfig`, `setMoaConfig`, `runMoa`, `setChatRouting` |
| `src/shared/ipc.ts` | Add `MoaTeam`, `MoaMember`, `MoaConfig` interfaces; add `PiApi` methods |
| `src/renderer/src/components/chat/PromptInput.tsx` | Add `<RoutingToggle />` button in the toolbar row (between Web and Send) |
| `src/renderer/src/components/Icons.tsx` | Add `PiRoutingIcon` (inline SVG from `resources/pi-routing.svg`, paths converted to `fill="currentColor"`, following the `PiLogoIcon` non-standard-viewBox pattern) |
| `src/renderer/src/store/useAppStore.ts` | Add `routingEnabled?: boolean`, `routingTeamId?: string` to `PiState` |
| `src/renderer/src/components/settings/SettingsView.tsx` | Add "Mixture of Agents" tab to `SettingsTab` union + tab bar + render branch |
| `src/renderer/src/components/settings/DesktopChangelog.tsx` | Add v0.4.0 entry |
| `package.json` | Bump to 0.4.0 |

### The MOA engine (`src/main/moa/engine.ts`)

```ts
export async function runMoa(
  message: string,
  team: MoaTeam,
  modelRegistry: ModelRegistry,
  sessionMessages: AgentMessage[],
  mode: "basic" | "advanced",
  options?: { maxLayers?: number; confidenceThreshold?: number }
): Promise<MoaResult>
```

**Flow:**

1. **Build shared context**: Convert `sessionMessages` to LLM format via `convertToLlm()` (SDK export). Create a `Context` with the user's new message + existing history + a team-member system prompt.

2. **Fan out**: For each team member, resolve the model via `modelRegistry.find(provider, modelId)`, get auth via `modelRegistry.getApiKeyAndHeaders(model)`, and call `completeSimple(model, context, { apiKey })`. Run all in parallel (`Promise.allSettled`).

3. **Aggregate**: Feed all team responses into an aggregator model with a synthesis system prompt. Call `completeSimple` again.

4. **Score (Advanced only)**: The aggregator also outputs a confidence score (0–10) for each team response. If `mode === "advanced"` and any score is below the threshold (default 6), re-query those team members with a refined prompt that includes the aggregator's feedback. Repeat up to `maxLayers` (default 3).

5. **Return**: `{ briefing: string, teamResponses: [{model, response, score?}], layers: number, confidence: number }`

### How the briefing gets injected

Uses the exact same pattern as `injectWebNudge()` (PiSessionManager.ts:265–278) — `appendCustomMessageEntry` with `display: false` so the briefing is in the LLM's context but not shown as a chat message:

```ts
async prompt(message, opts) {
  if (this.routingEnabled && this.routingTeamId) {
    const result = await this.runMoa(message);
    const sm = this.session.sessionManager;
    sm.appendCustomMessageEntry("moa-briefing", result.briefing, false, {
      team: team.name, layers: result.layers, confidence: result.confidence
    });
  }
  await this.session.prompt(message, opts);
}
```

### The toolbar button

A toggle in the chat input toolbar (next to Web/Tools), using the `PiRoutingIcon`:
- **Click (when off)**: Enables routing, shows a dropdown to pick a team (if multiple teams exist)
- **Click (when on)**: Disables routing
- **Right-click**: Opens team picker dropdown regardless of state
- Active state: `border-accent/40 bg-accent/15 text-accent` (matches existing Tools/Web toggles — icon adapts via `currentColor`)
- Placeholder reflects state: `"🔀 Pi Routing: Team Alpha — ask away"`

### Settings panel — "Mixture of Agents" tab

Two sub-tabs: **Basic** and **Advanced**.

**Basic tab:**
- Team list (cards) with create/edit/delete
- Each team: name, members (pick from available models), aggregator model
- "Test team" button — runs a sample prompt through the team and shows the briefing

**Advanced tab:**
- Everything in Basic, plus:
- `maxLayers` slider (1–5, default 3)
- `confidenceThreshold` slider (0–10, default 6)
- Toggle: "Show team responses in chat" (collapsible sections showing each member's output + score)
- Toggle: "Allow manual re-query" (shows a "Re-query team" button in the chat)

### Config persistence (`src/main/moa/config.ts`)

Following the `favorites.ts` pattern — stored at `userData/moa-teams.json`:

```ts
interface MoaConfig {
  teams: MoaTeam[];
  defaultMode: "basic" | "advanced";
  advanced: {
    maxLayers: number;           // default 3
    confidenceThreshold: number; // default 6
    showTeamResponses: boolean;  // default false
    allowManualRequery: boolean; // default true
  };
}

interface MoaTeam {
  id: string;
  name: string;                  // "Team Alpha"
  members: MoaMember[];
  aggregatorModel: { provider: string; modelId: string };
}

interface MoaMember {
  provider: string;
  modelId: string;
  role?: string;                 // optional: "architect", "reviewer", "implementer"
}
```

### Error handling

- **No teams configured**: Routing button disabled with tooltip "Configure a team in Settings → Mixture of Agents"
- **A team member has no auth**: caught by `Promise.allSettled`, member marked "failed", aggregation proceeds with available responses
- **All members fail**: MOA skipped, diagnostic toast warns user, normal prompt proceeds without enrichment
- **User aborts mid-MOA**: `AbortController` cancels in-flight calls, prompt proceeds without enrichment
- **Chat-mode tabs only**: like Tools/Web, Routing button only appears in `mode === "chat"`

### Progress events

The engine emits `pi:moa:progress` events during fan-out:
- `{ phase: "fanning-out" | "aggregating" | "scoring" | "re-querying", layer: number, member?: string, progress: number }`
- Renderer shows a subtle "Pi Routing: consulting 3 models…" indicator

## Implementation order

1. Types + config persistence (`moa/types.ts`, `moa/config.ts`)
2. IPC handlers + preload + shared types
3. MOA engine (`moa/engine.ts` + `moa/prompts.ts`)
4. `PiSessionManager` integration (routingEnabled, prompt override, runMoa)
5. `PiRoutingIcon` in `Icons.tsx` (inline SVG, `fill="currentColor"`)
6. `RoutingToggle.tsx` (toolbar button + team picker)
7. `PromptInput.tsx` integration (add button to toolbar)
8. `MoaPanel.tsx` (settings — Basic tab, then Advanced)
9. `SettingsView.tsx` integration (add the tab)
10. Store changes (`routingEnabled`, `routingTeamId` in PiState)
11. Progress events + chat indicator
12. Changelog + version bump to 0.4.0
13. Typecheck + lint + test + build + ship

## What this does NOT do

- **Does not modify `models.json`** — MOA teams stored separately in `userData/moa-teams.json`
- **Does not register a synthetic aggregator model** — MOA runs as pre-processing outside the agent loop
- **Does not work in code-mode tabs** — only chat-mode (pre-processing makes sense there)