# codex.md — Guide for Codex reviewing Pi Desktop

You are reviewing **Pi Desktop**, a macOS desktop app for the Pi coding agent.
This file is your onboarding and your guardrails. Read it fully before proposing
changes. Your job is to **find and propose improvements**; a separate reviewer
(Claude) will vet your changes, update the docs, and handle the release.

> Codex's native instructions file is `AGENTS.md`; this project uses `codex.md`
> by request. If you also read `AGENTS.md`, treat this file as authoritative.

---

## What the app is

- A native macOS desktop client (an Electron app) that runs the **Pi coding
  agent SDK** in-process — no separate CLI. Users chat with an AI coding agent,
  run multiple parallel sessions in tabs, manage models, and use orchestration
  features (Pi Routing / Mixture of Agents, and Tag Team / sequential relay).
- Open source: https://github.com/rubengarciajr/pi-desktop

## Tech stack

- **Electron 38** + **electron-vite** (build) + **electron-builder** (packaging)
- **React 18** + **TypeScript** + **Tailwind CSS** (renderer)
- **Zustand** (renderer state) — `src/renderer/src/store/useAppStore.ts`
- **Vitest** (tests), **ESLint** + **Prettier** (lint/format)
- Agent SDK: `@earendil-works/pi-coding-agent`

## Architecture — three processes

Electron's standard split. Respect the boundaries; they are load-bearing.

1. **Main** (`src/main/`) — Node process. Owns the SDK, filesystem, git/GitHub,
   models config, windows/menu/tray, and all privileged work.
2. **Preload** (`src/preload/index.ts`) — the ONLY bridge. Exposes a typed
   `window.pi.api` (invoke) and `window.pi.events` (subscribe) to the renderer.
   Built as **CommonJS** (`index.cjs`) because the sandboxed renderer can't load
   ESM — don't change that.
3. **Renderer** (`src/renderer/src/`) — React UI. No Node access; everything goes
   through `window.pi`. Loaded from a `file://` origin (matters — see Landmines).

Shared TypeScript contracts live in `src/shared/` (notably `ipc.ts`).

### Directory map
```
src/main/
  index.ts            app bootstrap (window → IPC → session pool)
  ipc.ts              ALL ipcMain handlers (the API surface)
  window.ts menu.ts tray.ts shortcuts.ts updater.ts
  models.ts           custom models (~/.pi/agent/models.json)
  favorites.ts        favorites (userData/favorites.json)
  github.ts git.ts    GitHub/git integration
  packages.ts installer.ts webSearch*.ts
  pi/
    PiSessionManager.ts   wraps one SDK session (per tab)
    SessionPool.ts        manages managers keyed by tabId
    SharedDepsCache.ts    cached AuthStorage/ModelRegistry/SettingsManager
    MessageCache.ts sdkVersion.ts
  moa/                Pi Routing (Mixture of Agents) engine + config
  tagteam/            Tag Team (sequential relay) orchestrator + config
src/preload/index.ts  window.pi bridge
src/shared/ipc.ts     PiApi + event types (source of truth for the bridge)
src/renderer/src/
  App.tsx main.tsx index.css
  store/useAppStore.ts     per-tab state, actions
  components/
    chat/       ChatView, PromptInput, Markdown, ToolCallBlock, RoutingToggle,
                TagTeamToggle, FilePath, FilePathMenu, …
    model/ sessions/ settings/ extensions/ packages/
    Sidebar TabBar StatusBar Icons …
```

### The IPC pattern (follow it exactly for any new call)
A single call touches four files. Adding/changing one means editing all four:
1. `src/main/ipc.ts` — `handle("pi:some.thing", async (a) => …)`
2. `src/preload/index.ts` — `someThing: invoke("pi:some.thing")`
3. `src/shared/ipc.ts` — add the method's type to `PiApi`
4. renderer — call `window.pi.api.someThing(args)`

### Session model
- One **tab** = one `PiSessionManager` (an SDK session), managed by `SessionPool`
  keyed by `tabId`. Most `handle()`s resolve the manager via the pool by `tabId`.
- Tabs have a **mode**: `"chat"` (no folder, opt-in tools) or `"code"`
  (folder-bound, full tools).

---

## Commands — verify before proposing anything

```
npm run typecheck     # tsc for node + web configs — MUST pass
npm run lint          # eslint (0 errors; warnings tolerated but don't add new ones)
npm run test          # vitest
npm run check         # typecheck + lint + test together
npm run build         # electron-vite build (proves main/preload/renderer bundle)
npm run dev           # runs the live app (electron-vite dev, hot reload)
```
A change is not "done" until `npm run check` and `npm run build` pass. Prefer
adding a Vitest test for any pure logic you touch or add (see
`src/shared/filePath.test.ts`, `version.test.ts` for the style). Tests run in a
**node** env — don't import Electron/DOM into files under test (that's why
`models.ts`, which imports `electron`, has no direct unit test).

## Conventions

- **Match the surrounding code.** Follow existing naming, file layout, comment
  density, and idioms. This codebase favors focused files and clear comments
  explaining *why*, not *what*.
- TypeScript throughout; keep the strict-ish typing. No `any` unless the SDK
  boundary forces it (and it's already common at that boundary).
- Renderer imports shared types via relative path (e.g. `../../../../shared/ipc`).
- Icons are inline SVG components in `components/Icons.tsx`, colored via
  `currentColor` so they theme. Don't add raster/`<img>` icons for UI chrome.
- UI is dark-first with a teal accent; colors come from Tailwind tokens
  (`text-accent`, `bg-bg-subtle`, `border-border`, …). Don't hardcode hex.

---

## Landmines — hard-won, please respect

These caused real bugs. Flag violations, and don't reintroduce them.

- **`setActiveToolsByName(names)` REPLACES the entire active tool set** (it sets
  `agent.state.tools = …`). `PiSessionManager.applyChatTools()` deliberately
  early-returns in **code mode** so it never wipes a code session's tools.
  Enabling chat Web/Tools in code mode requires an *additive* approach, not a
  naive call. (Web-in-code is a known TODO — see below.)
- **Custom-model auth lives in two places.** A model appears in the switcher /
  is selectable only if `modelRegistry.hasConfiguredAuth(model)` is true —
  which checks `authStorage.hasAuth(provider)` OR a configured `models.json`
  `apiKey`. A blank key stored as the literal `$API_KEY` reads as an *unset env
  var* → the provider is hidden/unselectable. Localhost providers are healed to
  a literal `"local"` key on launch (`healCustomModelKeys`), and custom keys are
  mirrored into `authStorage` (`registerCustomProviderKeys`) so mid-session
  add/edit works without a restart. Don't undo either.
- **Two registry instances.** The switcher list uses the tab's refreshed
  registry; the running SDK session validates selection against its *own*
  embedded registry (both share one `authStorage`). Changing model auth flow
  requires keeping these consistent.
- **Renderer `localStorage` does NOT reliably persist under the `file://`
  origin.** Favorites were moved to `userData/favorites.json` via the main
  process for this reason. Persist real user data in a main-process file, not
  `localStorage`.
- **`AbortSignal.timeout` / `fetch` run in main** (Node), not the renderer —
  localhost/model probes must go through main IPC to avoid CORS/CSP.
- **Preload is CommonJS** (sandbox requirement). **Renderer loads via
  `file://`.** Don't assume a dev server / http origin at runtime.
- Native deps and code signing: the packaged app is ad-hoc signed; the updater
  strips the macOS quarantine flag from downloaded DMGs (Apple Silicon launch).

## Good places to look for improvements

- **Correctness & races:** async lifecycles in `PiSessionManager` / `SessionPool`
  (session switch/fork/new/clone), event routing (per-`tabId` gating), and
  cleanup of listeners/timers on tab switch.
- **Performance:** renderer re-render pressure during streaming (the message
  list is virtualized; watch for unmemoized work), main-thread blocking calls.
- **Robustness:** error handling around SDK/network calls, IPC input validation.
- **MOA (`src/main/moa/`) and Tag Team (`src/main/tagteam/`)** orchestration —
  edge cases, cancellation, and the multi-stage relay chaining.
- **Simplification / dead code / duplication** — welcome, if behavior-preserving.
- **Test coverage** for pure logic that lacks it.

## Guardrails — what NOT to do

- **Do not bump the version, edit changelogs, tag, or publish releases.** That's
  handled by the human + Claude after review. (A `v*` tag push triggers the CI
  release — never create one.)
  - Changelogs that Claude maintains, for reference only:
    `CHANGELOG.md`, `docs/WEBSITE_CHANGELOG.md`, and the in-app
    `src/renderer/src/components/settings/DesktopChangelog.tsx`.
- **Don't broaden scope.** Keep each change focused and behavior-preserving
  unless the change *is* the behavior fix. No drive-by rewrites or dependency
  bumps.
- **Don't touch** the preload module format (CJS), the `file://` load, the
  code-signing/entitlements, or the SDK integration boundaries without a clear,
  well-explained reason.
- **Never commit secrets.** Real API keys live in `~/.pi/agent/models.json` on
  the user's machine — never hardcode or echo keys.

## How to propose changes

1. Work on a branch; keep commits focused with a clear message (what + why).
2. Make `npm run check` and `npm run build` pass. Add/adjust tests for logic.
3. Open a PR (or leave a clear diff + rationale). For each change, explain the
   problem, the fix, and any risk — especially anything near a Landmine above.
4. If a change needs live verification in the running app, say so explicitly;
   the reviewer will run `npm run dev` and confirm.

## Known TODO (fair game to tackle, with care)

- **Web search in code sessions.** Today the chat Web toggle is chat-only because
  `setActiveToolsByName` replaces the tool set. Making it work in code mode needs
  an additive apply (append the native web tools to the code session's existing
  active set, and register the native web tool for code sessions) — implemented
  carefully so it never drops the code tools. Requires live testing.
