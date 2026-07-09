# Tag Team — Sequential Model Relay Feature (v0.5.0)

## What it does

**Tag Team is a fundamentally different concept from Mixture of Agents (MOA):**

| | MOA (Pi Routing) | Tag Team |
|---|---|---|
| **How models work** | **Parallel** — N models fan out simultaneously, their answers are aggregated into a briefing, main model builds with that briefing | **Sequential** — Model A does the heavy lifting, then Model B takes over and improves/refines it |
| **Analogy** | A team of consultants giving advice at once | A wrestling tag team — one builds, tags the next who finishes |
| **Output** | One synthesized briefing → one main response | Model A's full work → Model B's improved work, visible separately |
| **Content window** | Team results are hidden (briefing only) | Each model gets a **fresh tab** with only what it needs — saves context window |
| **Handoff** | Automatic (one-shot) | Auto-chain: Model A finishes → new tab opens for Model B → B runs the handoff prompt automatically |

**Example flow (user's stated use case):**
1. User enables Tag Team in the chat toolbar, selects "Build & Polish" team (Minimax M3 → Codex 5.5)
2. User prompts: "Build a React todo app"
3. Minimax M3 builds out the idea/code in the current tab → finishes
4. **A new tab auto-opens** with Codex 5.5, carrying only Model A's output + the custom handoff prompt ("Review the code above and improve it")
5. Codex 5.5 automatically starts working — no clicks needed
6. The user sees a clear "TAG" indicator showing the handoff happened
7. Tab bar shows icons/badges so you know which model owns which tab

## The user's 4 requests, mapped

1. **"Add to sidebar — called Tag Team"** → Top-level sidebar nav item (like Model/Extensions/Packages), full-page view for building/editing/managing teams
2. **"Add icon to chat — click it cycles through teams"** → A `TagTeamToggle` button in the chat toolbar (next to RoutingToggle). Single-click cycles to the next team; shows the active team name. Icon = the collaboration.svg the user provided.
3. **"Fix Routing — remove the word Routing, show the MOA name"** → In `RoutingToggle.tsx` line 94, change the label so it shows the team name (or a compact fallback) instead of "Routing" when off/no-team.
4. **"Detailed panel for building a team — edit and remove"** → The TagTeamView with a full team editor: add/edit/delete teams, define the model sequence (starter → finisher, optionally more), write the handoff prompt, test it.

---

## Architecture

### New files

```
src/main/tagteam/
  ├── types.ts          # TagTeamTeam, TagTeamStage, TagTeamConfig, events
  ├── config.ts         # Load/save to userData/tag-teams.json (favorites.ts pattern)
  └── orchestrator.ts   # The relay engine: runs Model A, creates new tab, seeds Model B, runs handoff

src/renderer/src/components/
  ├── chat/TagTeamToggle.tsx      # Toolbar button — click to cycle teams, shows team name
  ├── settings/TagTeamView.tsx    # Full-page sidebar view — team list + editor
  └── (Icons.tsx gets a new TagTeamIcon)
```

### Modified files

| File | Change |
|---|---|
| `src/renderer/src/store/useAppStore.ts` | Add `"tagteam"` to `View` union; add `tagTeamEnabled`, `tagTeamTeamId`, `tagTeamStage` to `PiState`; add `tagTeamModelRole` to `Tab`/`TabState` for the badge; `emptyTabState` |
| `src/renderer/src/components/Sidebar.tsx` | Add `{ id: "tagteam", label: "Tag Team", Icon: TagTeamIcon }` to `NAV_ITEMS` |
| `src/renderer/src/components/Icons.tsx` | Add `TagTeamIcon` from collaboration.svg (`stroke="currentColor"`, themed) |
| `src/renderer/src/App.tsx` | Lazy import `TagTeamView`, add `{activeView === "tagteam" && ...}` render block |
| `src/renderer/src/components/chat/PromptInput.tsx` | Add `<TagTeamToggle />` after `<RoutingToggle />`; update placeholder text |
| `src/renderer/src/components/chat/RoutingToggle.tsx` | **Fix #3:** remove "Routing" word, show team name |
| `src/renderer/src/components/chat/ChatView.tsx` | Add `tagteam:handoff` handler in `onExtUi` listener (shows "TAG" indicator) |
| `src/renderer/src/components/TabBar.tsx` | Add Tag Team model-role badge (e.g. "A"/"B" chip or collaboration icon) next to `GitDirtyDot` |
| `src/shared/ipc.ts` | Add `TagTeamTeam`/`TagTeamStage`/`TagTeamConfig` types; `getTagTeamConfig`/`setTagTeamConfig`/`setChatTagTeam`/`tagTeamTest` on `PiApi`; `onExtUi` already exists |
| `src/preload/index.ts` | Wire the 4 new invokes |
| `src/main/ipc.ts` | `pi:tagteam.get`, `pi:tagteam.set`, `pi:chat.setTagTeam`, `pi:tagteam.test` handlers |
| `src/main/pi/PiSessionManager.ts` | Add `tagTeamEnabled`, `tagTeamTeamId`, `tagTeamStage` fields; `setTagTeamEnabled()`; hook `prompt()` to launch the relay after Model A finishes |
| `src/main/pi/SessionPool.ts` | New `createHandoffTab(sourceTabId, cwd, modelSpec, handoffContext)` — creates a new tab, sets Model B, seeds context |
| `src/renderer/src/components/settings/DesktopChangelog.tsx` | v0.5.0 entry |
| `docs/WEBSITE_CHANGELOG.md` | v0.5.0 entry |
| `package.json` | Bump to 0.5.0 |

---

## Detailed design

### Tag Team config (`src/main/tagteam/types.ts`)

```ts
export interface TagTeamStage {
  provider: string;
  modelId: string;
  /** Optional role label shown in the UI: "Builder", "Reviewer", "Finalizer" */
  role?: string;
  /** The prompt to send to the NEXT model after this one finishes.
   *  For the last stage, this is unused. Supports {previous_output} placeholder. */
  handoffPrompt?: string;
}

export interface TagTeamTeam {
  id: string;
  name: string;           // "Build & Polish"
  stages: TagTeamStage[]; // [minimax (starter), codex (finalizer)]
}

export interface TagTeamConfig {
  teams: TagTeamTeam[];
  defaultTeamId?: string;
}
```

A team is an **ordered list of stages**. Each stage is one model. The handoff prompt tells the next model what to do. The last stage is the "finalizer" — it has no handoff prompt. This supports 2+ models (the user mentioned starter + finalizer, but the architecture scales).

### The orchestrator (`src/main/tagteam/orchestrator.ts`)

This is the core engine. It lives in the main process because only there can we await sequential turns and create new tabs.

**Flow (auto-chain, new-tab-per-stage):**

```
User sends prompt (in Tab 1)
  → PiSessionManager.prompt() detects tagTeamEnabled
  → session.prompt(userMessage) runs normally (Model A / stage 0)
  → session.prompt() promise RESOLVES (Model A finished)
  → orchestrator.handoffToNextStage() fires:
      1. Reads Model A's output: this.session.messages (the last assistant message)
      2. Calls pool.createHandoffTab():
         - creates a new PiSessionManager (Tab 2)
         - sets the new session's model to stage 1's model (Codex 5.5)
         - seeds the new session with Model A's output via appendCustomMessageEntry()
           or appendMessage() (visible, so Codex sees the code)
      3. Injects the handoff prompt as a hidden context message
      4. Auto-prompts the new session with a compact trigger:
         "[Tag Team handoff from Minimax M3] {handoffPrompt}"
      5. Emits EXT_UI_EVENT { type: "tagteam:handoff", fromTabId, toTabId, fromModel, toModel }
  → Renderer receives the event → switches to Tab 2 → shows "TAG" indicator
```

**Key SDK methods used (confirmed to exist):**
- `await this.session.prompt(message)` — resolves on turn completion (`agent_end`)
- `await this.session.setModel(model)` — mid-session model change
- `this.session.messages` — full message history (read Model A's output)
- `sessionManager.appendCustomMessageEntry(type, content, display, details)` — inject hidden context (MOA pattern at PiSessionManager.ts:637)

**Why a new tab per stage:** The user explicitly said *"to save size in the content window, it should maybe open a new tab with the icon so the user knows that this is a TAG team action."* A fresh tab means Model B's context window only carries what it needs (Model A's output + the handoff prompt), not the entire session history.

### Creating the handoff tab (`SessionPool.createHandoffTab`)

```ts
async createHandoffTab(
  sourceTabId: string,
  cwd: string | undefined,
  modelSpec: { provider: string; modelId: string },
  seedContext: string,     // Model A's output
  handoffPrompt: string,
): Promise<{ tabId: string }> {
  const tabId = `tagteam-${Date.now()}`;
  const mgr = await this.createForTab(tabId, cwd, { chatMode: true });
  // Set Model B
  await mgr.setModel(modelSpec.provider, modelSpec.modelId);
  // Seed the session with Model A's output as a visible user-style message
  // so Model B sees the code it's improving.
  const session = (mgr as any).session;
  const sm = session?.sessionManager;
  if (sm?.appendMessage) {
    await sm.appendMessage({ role: "user", content: seedContext });
  }
  // Auto-prompt with the handoff instructions
  await mgr.prompt(`[Tag Team — continuing from a previous model]\n\n${handoffPrompt}`);
  return { tabId };
}
```

The renderer is notified via the `tagteam:handoff` ext-ui event (already tabId-tagged by `attachEvents`), creates the Tab UI, switches to it, and marks it with the role badge.

### The toolbar toggle (`TagTeamToggle.tsx`)

Mimics `RoutingToggle` but with **cycle-on-click** behavior (the user said "click it and it cycles through the teams"):

- **Click:** if 0 teams → disabled (tooltip: "Configure a team in Tag Team"). If 1+ teams → cycle to the next team and enable. On the last team, clicking again wraps to "off".
- **Shows:** the active team's name (e.g. "Build & Polish"), or "Tag Team" (faint) when off.
- **Active state:** `border-accent/40 bg-accent/15 text-accent` with the `TagTeamIcon`.
- **Placeholder:** the chat input shows "🏷 Tag Team: Build & Polish" when active.

### The sidebar view (`TagTeamView.tsx`)

A full-page view (lazy-loaded) with:

**1. Team list** — cards showing each team's name + a visual of the stage sequence (model chips with arrows between them):
```
Build & Polish
[Minimax M3] → [Codex 5.5]
                 Builder      Finalizer
[Edit] [Delete]
```

**2. Team editor** (modal or inline panel):
- Team name field
- **Stage builder:** an ordered list of stages. Each stage row has:
  - A model picker (`.form-select` — reuses the fixed dropdown from the MOA work)
  - A role label ("Builder", "Reviewer", "Finalizer" — free text)
  - A handoff prompt textarea (what to tell the NEXT model)
  - Drag/reorder or up/down arrows to change the sequence
  - Remove button
- "+ Add stage" button
- **Test button** — runs a sample prompt through stage 0, then simulates the handoff to stage 1, showing both outputs. Uses a new `pi:tagteam.test` IPC that runs the orchestrator with a test message.
- Save / Cancel

**3. "New Team" button** — creates a new team with a starter stage + a finalizer stage pre-filled.

### The sidebar entry + icon

- `View` union gets `"tagteam"`
- `NAV_ITEMS` gets `{ id: "tagteam", label: "Tag Team", Icon: TagTeamIcon }`
- `TagTeamIcon` is built from the user's `resources/collaboration.svg` — it uses `stroke="currentColor"` (the SVG is stroke-based, unlike pi-routing which is fill-based), so it adapts to dark/light themes automatically. The SVG has a complex viewBox (0 0 682.667 682.667 with a transform), so I'll simplify the viewBox to a clean 0 0 512 512 and use the two-handshake paths that read clearly at 12-18px sizes.

### Fix #3 — RoutingToggle label

In `RoutingToggle.tsx:94`, change:
```tsx
{routingEnabled && activeTeam ? activeTeam.name : "Routing"}
```
to show the team name (or a compact icon-only state) instead of the word "Routing". When off with teams configured, show the first team's name faintly, or just the icon. The exact approach: when off, show the icon + first team name in faint text (so the user sees what they'd activate); when on, show icon + active team name in accent.

### Tab badge (`TabBar.tsx`)

Add a Tag Team badge next to `GitDirtyDot` at line 62. When a tab was created by a Tag Team handoff, show a small chip with the stage role ("A" / "B") or a collaboration icon in accent color. This uses a new `tagTeamModelRole` field on `TabState`.

---

## Implementation order

1. **Types + config** (`tagteam/types.ts`, `tagteam/config.ts`)
2. **IPC** — shared/ipc.ts types, preload, main/ipc.ts handlers
3. **Icon** (`TagTeamIcon` in Icons.tsx from collaboration.svg)
4. **Sidebar entry** — View union, NAV_ITEMS, App.tsx lazy render
5. **TagTeamView** — the full-page team management panel (list + editor + test)
6. **Orchestrator** (`tagteam/orchestrator.ts`) + `SessionPool.createHandoffTab`
7. **PiSessionManager integration** — fields, setter, prompt() hook
8. **TagTeamToggle** — toolbar button with cycle behavior
9. **PromptInput integration** — add toggle, placeholder
10. **ChatView** — `tagteam:handoff` event handler + "TAG" indicator
11. **TabBar badge** — role chip on handoff-created tabs
12. **RoutingToggle fix** — remove "Routing" word
13. **Changelog + version bump** to 0.5.0
14. **Typecheck + lint + build**

---

## What this does NOT do

- **Does not replace MOA** — both features coexist. MOA = parallel synthesis; Tag Team = sequential relay. They use different icons, different config files, different engines.
- **Does not run in code-mode tabs** — like Routing, only in `mode === "chat"` (the handoff new-tab pattern is chat-centric).
- **Does not copy any text/names from hermes agent** — per the user's standing constraint. All prompts and naming are original.
- **Does not modify the SDK** — uses existing `session.prompt()`, `session.setModel()`, `sessionManager.appendMessage()` APIs.