# Changelog

All notable changes to Pi Desktop are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
