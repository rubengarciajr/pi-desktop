# Changelog

All notable changes to Pi Desktop are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

---

## [0.6.1] — 2026-07-17

### Fixed
- **Surface model-request errors instead of failing silently.** `onAgentEvent` now emits the SDK's `auto_retry_start` / `auto_retry_end` signals as diagnostics — a "retrying: <error>" notice and, on retry exhaustion, "Model request failed after N attempts: <finalError>". Previously a retried-then-failed turn ended with no visible error (e.g. a provider rejecting an unsupported thinking level looked like a silent freeze).

---

## [0.6.0] — 2026-07-17

### Added
- **Auto-install updates on restart** — the update banner now downloads, installs the new version in place, and relaunches (Download → Install & Restart), instead of asking you to drag the app to Applications. A detached helper waits for the app to quit, swaps the bundle (staged, with restore-on-failure), clears quarantine, and relaunches. Falls back to opening the DMG in Finder when auto-install can't run (dev mode, non-writable install dir). No Apple Developer ID required — the app stays ad-hoc signed. (#12)

### Changed
- **Pi SDK 0.80.6 → 0.80.10** — brings Kimi K3, xAI Grok 4.5, and the latest provider catalogs. Migrated the auth/model core from `AuthStorage` + `ModelRegistry` to the new async `ModelRuntime` (one shared instance per agentDir passed into every session's services). `login`/`setApiKey`/`logout`/`getAuthStatus`/model listing all ported; existing users' auth.json is preserved. (#11)
- **Removed the nested-pi-ai compat loader** — MOA and Tag Team now call `modelRuntime.completeSimple()` directly (auth resolved internally), eliminating the fragile module resolution behind the v0.5.6 asar "Could not locate pi-ai/compat" bug.

---

## [0.5.9] — 2026-07-13

### Added
- **Right-click session management** — right-click any session to add/remove it from Favorites or delete it from disk (context menu at the cursor). Sessions in a favorited folder now show a star indicator.

---

## [0.5.8] — 2026-07-13

### Added
- **Pi Routing visibility** — a collapsible per-agent report card after each run (each member's full response, confidence score, and the synthesized briefing); real-time per-agent progress ("2/3 models responded"); a branded status-bar indicator with live progress and confidence; and a pulsing routing icon in the tab bar.

---

## [0.5.7] — 2026-07-13

### Changed
- **Mixture of Agents (Pi Routing) promoted to a top-level sidebar item**, below Tag Team — no longer buried in Settings.

---

## [0.5.6] — 2026-07-13

### Fixed
- **Pi Routing in the packaged app** — fixed "Could not locate pi-ai/compat" (electron-builder flattens dependencies inside the asar bundle; the engine now checks both the flattened and nested layouts and uses `createRequire` to load from inside the asar). MOA and Tag Team work in the installed DMG.
- **Streaming freeze** — the UI no longer stays stuck on "Thinking..." with the input disabled after a model finishes; `isStreaming` now resets on three independent signals (message-end with a terminal stop reason, backend state pushes, and a 30-second watchdog).

---

## [0.5.5] — 2026-07-11

### Changed
- **Toolchain upgrade** — Electron 38 → 41, Vite 5 → 6, electron-vite 2 → 3, electron-builder 25 → 26 (build target `chrome146`). Preload still emits CommonJS (`index.cjs`), renderer keeps relative asset paths for the `file://` origin, and `sandbox`/`contextIsolation`/`nodeIntegration` are set explicitly. `react-syntax-highlighter` is now a lazily-loaded chunk (`SyntaxCodeBlock`). Added a "max" thinking level.

### Fixed
- **Tag Team handoff prompt** — read from the sending stage, matching the UI contract ("Handoff prompt (sent to stage N+1)"). The old code read the receiving stage, so the final handoff always ignored the configured prompt (`src/main/tagteam/relay.ts`).
- **MOA `${threshold}` literal** — the aggregator prompt emitted the raw string instead of the configured confidence threshold value.
- **Slash-containing model IDs** — model references are now JSON-encoded (`src/shared/modelRef.ts`) so IDs like `anthropic/claude-sonnet-4` are no longer split incorrectly.
- **Version parsing** — `version.ts` strips per-segment non-numeric suffixes so pre-release/build tags no longer produce `NaN` and silently break the updater.
- **MOA re-query loop** now checks `signal?.aborted` before each iteration, avoiding a wasted round of API calls after cancellation.
- **`prompt()` cleanup** wraps the `finally` `emitState()` in try/catch so a throwing state listener can't mask the original error.

### Security
- **Removed the build-time `PI_UPDATE_TOKEN`** define; the update token is read from the filesystem only (no token baked into the distributed binary). Deleted `src/main/env.d.ts`.
- **Updater download hardening** — new `src/shared/updateUrl.ts` validates the DMG URL (GitHub host, https-only, owner/repo path prefix, `.dmg` extension); `basename()` closes a path-traversal vector.

### Tests
- Added units for `moa/engine`, `moa/prompts`, `tagteam/relay`, `shared/modelRef`, `shared/updateUrl`, plus pre-release version and `http://`/path-traversal update-URL coverage (37 tests, up from 21).

---

## [0.5.4] — 2026-07-09

### Changed
- **Pi SDK 0.80.3 → 0.80.5** — brings the new `openai-codex` models **GPT-5.6 Luna / Sol / Terra** (verified for ChatGPT OAuth), Claude Sonnet 5 in the GitHub Copilot catalog, zstd compression for the Codex SSE transport, Codex WebSocket rotation before the 60-minute backend cap, and the Copilot device-code login polling fix. Purely an SDK bump — no app-code changes; the model list picks up the new catalog automatically.

---

## [0.5.3] — 2026-07-09

### Added
- **Open in external editor** — a prompt-bar button opens the current draft in a configured editor (Pi's `externalEditor`), waits for it to close, and replaces the prompt with the saved contents. Resolution order: `userData/app-settings.json` `externalEditor` → Pi `settings.json` `externalEditor` → `$VISUAL` → `$EDITOR`. Runs in the main process via a temp file + `spawn`; GUI editors need a blocking flag (`code --wait`). Available in chat and code sessions. New `src/main/externalEditor.ts`, `src/main/appSettings.ts`.
- **Message spacing setting** — a Compact / Comfortable / Spacious control (Settings → Appearance) drives message horizontal padding via a `--msg-pad-x` CSS var (GUI analog of Pi's terminal `outputPad`). Persisted in `userData/app-settings.json` (not `localStorage`, which is unreliable under `file://`).
- **Live session-name updates** — the SDK's `session_info_changed` event (Pi 0.80.3) now renames the corresponding tab live in the store.

### Changed
- **Claude Sonnet 5 preset** — the Anthropic "Add Model" template now defaults to `claude-sonnet-5` (was `claude-sonnet-4-20250514`).

### Fixed
- **Model list refreshes on auth change** — OAuth login/logout and set-API-key now `invalidateSharedDeps()` + `refreshAllModelRegistries()` (the same path custom-model add/edit/remove already used), and `login()` rebuilds the active session's listing registry before emitting `done`. `ModelView` re-fetches on the auth `done` event. Previously a provider (re)connect — e.g. Codex — left the model list and ⌘M switcher stale until an app restart. (Note: the codex catalog is static in the SDK and tops out at GPT-5.5; models beyond that need **+ Add Model** with an explicit ID.)

---

## [0.5.2] — 2026-07-09

### Changed
- **Routing / Tag Team toggles show icon-only until active** — the Pi Routing and Tag Team toolbar buttons no longer display a team name when off (they used to show the first team's name); they show just the icon until a team is active, then the active team's name.
- **Routing and Tag Team now work in code sessions** — both toggles previously only appeared in chat; they now render in code mode (after selecting a folder) too. Their backend (`setRoutingEnabled` / `setTagTeamEnabled`) is already mode-agnostic. (Web and Tools remain chat-only: code sessions already have all tools on, and the chat Web/Tools path replaces the active tool set, which would wipe a code session's tools — web-in-code is a tracked follow-up.)

---

## [0.5.1] — 2026-07-09

### Changed
- **Tag Team icon** — swapped the placeholder inline glyph for the `collaboration.svg` artwork, inlined as `TagTeamIcon` (wired to `currentColor` so it themes on the dark UI). Because every placement renders `TagTeamIcon`, it now shows in all of them: the sidebar panel, the chat toolbar toggle, handoff/TAG tabs, and the Tag Team settings view.

---

## [0.5.0] — 2026-07-09

### Added — Tag Team (sequential model relay)
- **Tag Team — a Pi Desktop exclusive.** The opposite of Pi Routing/MOA: instead of running models in parallel, models work **sequentially**. The starter model builds out the work, then **tags** the next model, which takes over in a new tab and improves it — automatically, no clicks. Each handoff tab carries the previous model's output plus a per-stage handoff prompt (not the whole history), so the relay is context-efficient.
- **Multi-stage relay.** Teams have 2+ ordered stages (e.g. build → review → finalize). Each handoff tab is itself armed for the following stage, so the relay chains all the way through to the finalizer — not just a single A→B hop.
- **Full team management** — a new **Tag Team** sidebar panel to create/edit/delete teams, set each stage's model + role, write handoff prompts, and **Test** the relay (runs sequentially and previews every stage's output) before using it live. Config persists to `tag-teams.json` in `userData`.
- **Chat integration** — a toolbar button cycles through teams and shows the active one; **TAG badges** mark handoff-created tabs; a handoff indicator shows "Model A → Model B · new tab."

### Fixed — Pi Routing (Mixture of Agents)
- **MOA now loads** — fixed `ERR_PACKAGE_PATH_NOT_EXPORTED` that stopped the engine from importing pi-ai's `compat` layer. It now resolves the nested `@earendil-works/pi-ai/dist/compat.js` by absolute file path (cached), bypassing the package `exports` map; works in dev and inside the packaged asar. (`getCompat`/`resolveNestedCompat` in `moa/engine.ts`, reused by the Tag Team orchestrator.)
- **Test unsaved drafts** — the MOA and Tag Team Test buttons run against the in-editor draft (team object passed directly) instead of throwing "Team not found."
- **Editor polish** — provider badges + accent borders on selected models; a custom, consistently-spaced dropdown chevron; the routing toggle shows the team name instead of the word "Routing."

### Fixed — Tag Team hardening (pre-release review)
- Live relay now chains through **all** stages (was stopping after the first handoff). The next model always receives the previous output embedded directly in its prompt — no reliance on a session-internal seed that could silently no-op. Removed a duplicate handoff event that fired with null tab ids, and fixed a `setActiveTab` type error that was breaking `npm run typecheck`.

---

## [0.4.7] — 2026-07-08

### Fixed
- **Model repairs apply to all models automatically — no re-saving each one.** On launch, any localhost provider with a missing/`$API_KEY` placeholder key is healed in place (`healCustomModelKeys()` in `models.ts`, run at startup before the session pool initializes), and every custom provider's literal key is registered into the shared `authStorage` at session start and on refresh (`registerCustomProviderKeys()`). Because the session resolves request keys from `authStorage` first, this also makes an **edited API key take effect in the running session immediately** — no restart, no re-saving. (`listLocalProviderCredentials` generalized to `listCustomProviderCredentials`.)

---

## [0.4.6] — 2026-07-08

### Fixed
- **"No API key" when selecting a freshly-added local model** — the model list was refreshed live (v0.4.4) but the running session's own model registry wasn't, so a just-added local model appeared in ⌘M yet failed selection with `No API key for …`. The session validates model selection against the shared `authStorage`, so live-refresh now registers local providers' placeholder keys there (keeping the session's authStorage instead of swapping it). Local models are selectable immediately, no restart. (`listLocalProviderCredentials()` in `models.ts`; reworked `refreshModelRegistry()`.)

---

## [0.4.5] — 2026-07-08

### Fixed
- **Local models with a blank API key were hidden from the switcher** — a blank key was stored as the `$API_KEY` placeholder, which the SDK reads as an (unset) env var, so the provider was treated as unauthenticated and its models were filtered out of `getAvailable()`. Custom models on a localhost base URL now store a harmless literal key (`local`) instead — both when added and when edited — so they appear in ⌘M. Re-saving an affected model heals it. (`normalizeApiKey` / `isLocalUrl` in `models.ts`.)

---

## [0.4.4] — 2026-07-08

### Fixed
- **Custom model changes apply live** — adding, editing, or removing a custom model now refreshes the model registry for every open tab immediately, so it appears in the ⌘M switcher and the Available models list without opening a new tab or restarting. Adds `refreshModelRegistry()` on the session manager and `refreshAllModelRegistries()` on the pool, called from the custom-model IPC handlers after `invalidateSharedDeps()`.

---

## [0.4.3] — 2026-07-08

### Changed
- **Test connection now shows the server's models** — when a model server is reachable, the test lists its available model IDs as clickable chips; clicking one fills the Model ID field (and highlights the current match). Makes it obvious what to enter when the typed model name doesn't match the server's.

---

## [0.4.2] — 2026-07-08

### Added
- **Edit custom models** — the "Your custom models" list now has an **Edit** action alongside Remove. It reuses the Add Model form pre-filled with the model's current values (provider, base URL, API type, model id, display name, reasoning, context window), shown inline under the model. Renaming the provider or model id is handled by re-keying the entry, and leaving the API key blank preserves the existing key. Backed by a new `editCustomModel` in `models.ts` and a `pi:models.custom.edit` IPC.

---

## [0.4.1] — 2026-07-08

### Added
- **"Local" model preset** — a new quick preset in the Add Model form fills a generic `http://localhost:11434/v1` template (Ollama / LM Studio / llama.cpp) with the OpenAI-compatible API type and a dummy key, so a local model can be added without typing the endpoint by hand.
- **"Test connection" button** — pings the endpoint (`GET {baseUrl}/models`) before saving to confirm the server is reachable and reports whether the entered model ID is in the server's list. Runs via a new `pi:models.testConnection` main-process IPC to sidestep renderer CORS/CSP.

---

## [0.4.0] — 2026-07-08

### Added — Pi Routing (Mixture of Agents)
- **Pi Desktop exclusive** — create teams of models that collaborate on your prompts in parallel, synthesize a briefing, and let the main model build its response enriched by the team's analysis.
- New **Pi Routing** button in the chat toolbar (next to Tools and Web): toggle it on, pick a team, and every prompt is pre-processed by the MOA team before the main model responds.
- **Basic mode**: team fans out once per prompt, aggregator synthesizes, main model builds (single layer). **Advanced mode**: aggregator scores each response (0–10); low scorers are automatically re-queried with refined prompts (up to 5 layers), with manual re-query support.
- New **Mixture of Agents** settings tab with team CRUD, member/aggregator model selection, a test runner, and advanced tuning (max layers, confidence threshold, visibility toggles).
- Live progress indicator in the chat area ("Pi Routing: consulting N models…") during fan-out; the icon adapts to dark/light themes.

---

## [0.3.8] — 2026-07-08

### Changed — Sessions Panel
- Sessions are now **cards** with clear borders instead of flat rows — easier to scan and distinguish from the panel background.
- The **current session** is highlighted with an accent border, glow ring, and a "current" label, so you always know where you are.
- The active working folder is marked with accent color in the folder header and favorites list.
- The panel background is more strongly separated from the main chat area with a heavier divider.

---

## [0.3.7] — 2026-07-07

### Added
- **Interactive file paths** — clicking a file path anywhere in the conversation (inline path chips in messages, Read/Edit/Write/ls tool-call headers, and command output) opens a menu with **Reveal in Finder**, **Copy full path**, **Copy filename**, and **Copy relative path** (relative to the tab's working folder). Path detection is a shared, unit-tested heuristic (`src/shared/filePath.ts`) that recognizes absolute/`~`/relative paths and bare filenames while excluding URLs, dates, fractions, and version numbers. Adds a `pi:shell.revealPath` IPC (`shell.showItemInFolder`) alongside the existing `openPath`.

---

## [0.3.6] — 2026-07-07

### Fixed
- **Conversations open at the newest message** — the Virtuoso message list had no initial scroll position, so opening a favorite or saved session dropped you at the top (the oldest message). It now sets `initialTopMostItemIndex` to the last message and is keyed by tab, so a loaded conversation opens scrolled to the bottom (newest), the way a chat should.

---

## [0.3.5] — 2026-07-07

### Fixed
- **Favorites persist across restarts and updates** — favorites were stored in renderer `localStorage`, which does not survive relaunches under the app's `file://` origin, so they appeared to reset. They now persist to `favorites.json` in the app's `userData` directory (the same reliable location as the GitHub token) via a main-process IPC. A one-time migration carries over any favorites from the old `localStorage` location.

---

## [0.3.4] — 2026-07-07

### Fixed
- **One tab per folder** — opening a folder that was already open created a duplicate/clone tab. A new `focusExistingTab` store action now focuses the existing tab instead. Applied across the Sessions list, favorites, the `+` tab button, drag-and-drop, the sidebar, and the macOS *New Session* menu.
- **Clickable working-folder path** — the folder path at the top of a chat is now a button that opens the folder in Finder (new `pi:shell.openPath` IPC).

---

## [0.3.3] — 2026-07-06

### Fixed
- **Crash-on-launch on Apple Silicon** — the in-app update downloader was not stripping the `com.apple.quarantine` extended attribute from the downloaded DMG. On M-series Macs, an ad-hoc signed app cannot launch while quarantined, so the updated app crashed immediately. The downloader now runs `xattr -cr` on the DMG before opening it in Finder.

---

## [0.3.2] — 2026-07-06

### Fixed
- **Duplicate tab on "Start Chatting"** — the app creates an empty Chat tab on launch; "Start Chatting" was creating a second one instead of reusing it. Now it reuses the current tab and focuses the prompt immediately. A new tab is only created when there's no tab to reuse.
- **Glowing input border reliability** — the input's `transition-colors` CSS property was fighting the glow keyframe animation, suppressing it after first focus. Split the classes so the animated state has no transition and starts with a transparent border so the keyframe fully controls it. The glow now appears reliably on every empty chat.

---

## [0.3.1] — 2026-07-06

### Added — Update Experience
- **In-app update download** — the update banner now downloads the DMG directly in the app with a live progress bar, then opens the installer in Finder. No more browser detour. Falls back to opening the release page if the download fails.

### Fixed
- Version badge in the sidebar is now single-sourced from `package.json` via the preload bridge (`window.pi.versions.app`) — it can no longer drift out of sync.
- "Start Chatting" now focuses the prompt input immediately after creating the tab (also fixed the dead `Cmd+L` focus event that was dispatched but never listened for).
- Install one-liners in the docs no longer hardcode a version — they resolve the latest asset URL dynamically via the GitHub API.

---

## [0.3.0] — 2026-07-06 — 🎉 Public Release

### Added
- **Pi Desktop is now open source.** The full codebase is public at [github.com/rubengarciajr/pi-desktop](https://github.com/rubengarciajr/pi-desktop).
- In-app update check runs anonymously against the GitHub releases API — no token, no setup required. The optional `getUpdateToken()` fallback is kept for anyone who forks to a private repo.
- CI auto-publishes GitHub Releases via a safety-net step that flips drafts to published.
- Branch protection enabled on `main`: no force-pushes, no deletions.

### Changed
- Chat empty state: "Start Chatting" is now a clean h2 heading instead of a filled accent button. Hover turns it accent-colored.
- Glowing accent border on the message input when a chat or code session is empty — draws the eye to where you type.

### Security
- Git history rewritten to mask personal commit emails with GitHub's noreply address (`24701396+rubengarciajr@users.noreply.github.com`).
- All existing GitHub releases deleted (they contained private-source builds). Fresh v0.3.0 release ships clean.
- Compromised PAT (used during the private-repo phase) revoked. No tokens are baked into the shipped binary.

---

## [0.2.9] — 2026-07-04

### Performance
- Eliminated periodic 5-second UI freezes: git/GitHub polling and version probes moved off the main thread (`execFileSync` → async).
- Streaming chat no longer re-highlights code on every token — CodeBlock is memoized, markdown consts hoisted, message list virtualized (react-virtuoso).
- Renderer bundle cut from 1.7 MB to ~1.0 MB: PrismLight + selective language registration, vendor chunk splitting, lazy-loaded secondary views.

### Changed — Pi SDK 0.80.3
- Upgraded Pi agent SDK to 0.80.3 (Claude Sonnet 5, gpt-5.5 default, provider/stream fixes).
- Displayed SDK version now reads from the SDK itself — no more drift after bumps.
- Reasoning/thinking token counts surfaced in the status bar cost tooltip where providers report them.

### Removed
- Dead pi-CLI installer UI and "Install Pi" button — Pi Desktop runs the SDK in-process and never needed it.
- Unused Onboarding screen.

---

## [0.2.8] — 2026-06-22

### Security — P0 Fixes
- Fixed shell command injection in GitHub operations (`execSync` → `execFileSync` with arg arrays).
- Fixed command injection in package install/remove (removed `shell:true`).
- Fixed per-tab event misrouting: events without `tabId` are now dropped instead of defaulting to active tab.
- Fixed Install Pi button: now actually calls `startPiInstall()`.
- Removed `shell:true` from npm installer.
- Clear token file properly (`unlink` instead of `truncate`).

---

## [0.2.7] — 2026-06-22

### Fixed
- Slash command dropdown staying open after selecting a command.
- Enter now properly closes the dropdown and lets you type arguments or press Enter again to submit.
- Escape now dismisses the dropdown without clearing your text.

---

## [0.2.6] — 2026-06-22

### Added
- Upgraded Pi SDK to 0.79.10.
- Extension commands now load reliably with retry/backoff.
- Commands refresh automatically when switching tabs or installing packages.
- Skill removal and Restore to Stock now reload resources immediately.

### Fixed
- Accent colors not switching (CSS `:root` was overriding `[data-accent]`).
- Logo "i" dot invisible in light mode (now uses accent color).
- `settingsManager` not passed to session services (stale extensions).
- Dynamic app version in System panel (no longer hardcoded).

---

## [0.2.5] — 2026-06-22

### Added
- Remove individual skills from the Skills tab (hover to reveal Remove button).
- Restore to Stock: nuke all packages, extensions, skills, prompts, and themes back to 7 built-in tools.

### Fixed
- Light mode logo being invisible white (now uses `currentColor`).
- Accent/theme colors not switching: CSS variables use RGB triplets for Tailwind opacity support.

---

## [0.2.4] — 2026-06-22

### Fixed
- Window now shows immediately on launch (`show: true` instead of waiting for ready-to-show).
- Resources directory included in app package (tray icon, app icons).
- Added error handlers for renderer load failures and crashes.

---

## [0.2.3] — 2026-06-22

### Fixed
- Window created before session pool init to prevent startup deadlock.

---

## [0.2.2] — 2026-06-21

### Fixed
- Removed electron-updater entirely (was causing 404 errors on startup).
- Fixed package install using `require()` in ESM context.
- Fixed error overflow in package cards.

---

## [0.2.1] — 2026-06-21

### Fixed
- Fixed extension install failing silently (`require()` in ESM, switched to `await import()`).
- Added error display in package cards.

---

## [0.2.0] — 2026-06-21

### Added
- Dark / Light mode with system appearance detection.
- Accent color presets (Purple, Blue, Green, Orange, Pink, Teal, Red).
- In-app update checker with Download button.
- Update banner that appears when a new version is available.

### Fixed
- "Check for Updates" button not responding — now uses GitHub API.
- Theme switching now works with CSS variables instead of hardcoded colors.
- System theme changes update in real-time.

---

## [0.1.4] — 2026-06-21

### Added
- SDK-based package installation — install/remove pi packages without the CLI.
- System tab with dependency checker (Node.js, npm, Git, Pi CLI status).
- Copyable quick-start install commands for pi CLI in System tab.
- Links to pi.dev, documentation, quickstart guide, and models docs.
- Warning banner when Node.js is missing.

---

## [0.1.3] — 2026-06-21

### Fixed
- Removed blocking onboarding that required Node.js/npm — app runs SDK in-process.
- Pi CLI is now optional (installable from System tab).
- Simplified startup screen.

---

## [0.1.2] — 2026-06-21

### Added
- Custom model management with inline form and quick presets (Claude, OpenAI, Z.ai, MiniMax, MiMo, Grok).
- System tab with pi CLI installer and `models.json` location.
- Auto-update banner toast with restart button.
- GitHub Actions CI for auto-build on tag push.
- One-click terminal install command in README.

### Fixed
- "DMG is damaged" error — ad-hoc code signing via afterSign hook.
- `setModel` returning `{ success }` instead of full state.
- Model operations not passing `tabId`.
- Updated publish config to correct GitHub repo.

---

## [0.1.0] — 2026-06-21 — Initial Release

### Added
- Multi-tab parallel sessions with independent pi runtimes.
- Streaming chat with markdown rendering, syntax highlighting, and collapsible tool output.
- Slash command autocomplete with arrow-key navigation for commands, skills, and prompt templates.
- Pi package explorer: browse, install, and remove packages from npm registry.
- GitHub integration: PAT auth, create/attach repos, push/pull, per-folder linkage.
- Session management: resume, fork, clone, favorites, organized by folder.
- Model picker with provider grouping and thinking level control.
- Token usage and session cost display in the status bar.
- Extensions and Skills browser with tabs for extensions, skills, commands, and tools.
- Native macOS menu bar tray icon with quick actions.
- Drag-to-install DMG with custom Pi app icon.
- Smart scroll tracking that stays pinned or lets you scroll freely.
- PATH repair for GUI launches (Homebrew, nvm, Volta, fnm auto-detection).
- SharedDepsCache: cached AuthStorage/ModelRegistry/SettingsManager for fast tab creation.
- MessageCache: instant session switching with in-memory message caching.

### Keyboard Shortcuts
- `Cmd+M`: switch models
- `Cmd+N`: new session
- `Cmd+L`: focus prompt
- `Cmd+W`: close tab (or window if last tab)
- `Cmd+Shift+Enter`: follow-up message during streaming
- `Enter`: send (or select slash command when dropdown is open)
- `Shift+Enter`: newline
- Arrow keys + Enter: slash command autocomplete navigation
