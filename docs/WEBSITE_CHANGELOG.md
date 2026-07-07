# Pi Desktop — Website Changelog

> **Source of truth for pi-desktop.dev.**
> Current version: **v0.3.6** · Last updated: **July 7, 2026**
> Copy directly into the website's changelog section.

---

## v0.3.6 — July 7, 2026

### Fixes
- **Conversations open at the newest message** — opening a favorite or a saved session now starts scrolled to the bottom (the most recent message) instead of jumping to the top (the oldest).

---

## v0.3.5 — July 7, 2026

### Fixes
- **Favorites now stick** — favorited folders are saved to a file in the app's data folder instead of browser storage that didn't survive a relaunch. They now persist across restarts and app updates, and any favorites you already had are migrated over automatically.

---

## v0.3.4 — July 7, 2026

### Fixes
- **One tab per folder** — opening a folder that's already open now jumps to its existing tab instead of spawning a duplicate. Applies everywhere a folder can be opened: the Sessions list, favorites, the **+** tab button, drag-and-drop, the sidebar, and the macOS **New Session** menu.
- **Clickable working folder** — the folder path shown at the top of a chat is now a button; click it to reveal the folder in Finder.

---

## v0.3.3 — July 6, 2026

### Fixes
- **Fixed crash-on-launch on Apple Silicon** — the in-app update downloader now clears the macOS quarantine flag from the downloaded DMG before opening it, so the updated app launches cleanly instead of being blocked by Gatekeeper on M-series Macs.

---

## v0.3.2 — July 6, 2026

### Fixes
- **No more duplicate tabs** — "Start Chatting" now reuses the current tab instead of opening a second one. The prompt focuses immediately so you can start typing.
- **Glowing input border** now appears reliably on every empty chat, no longer requiring an app restart.

---

## v0.3.1 — July 6, 2026

### Update Experience
- **In-app update download** — The update banner now downloads the DMG directly in the app with a live progress bar, then opens the installer in Finder. No more browser detour.

### Fixes
- Version badge in the sidebar is now single-sourced from `package.json` — it can no longer drift out of sync.
- "Start Chatting" now focuses the prompt input immediately.
- Install commands in the docs no longer hardcode a version.

---

## v0.3.0 — July 6, 2026

### 🎉 Public Release — Pi Desktop is now open source
- The full codebase is public on GitHub at [github.com/rubengarciajr/pi-desktop](https://github.com/rubengarciajr/pi-desktop).
- In-app update check runs anonymously against the GitHub releases API — no token, no setup required.

### Chat UX
- "Start Chatting" is now a clean heading instead of a button.
- Glowing accent border on the message input draws the eye to where you type.

---

## v0.2.9 — July 4, 2026

### Performance
- Eliminated periodic 5-second UI freezes: git/GitHub polling and version probes moved off the main thread.
- Streaming chat no longer re-highlights code on every token — memoized CodeBlock, virtualized message list (react-virtuoso).
- Renderer bundle cut from 1.7 MB to ~1.0 MB: PrismLight + selective language registration, vendor chunk splitting, lazy-loaded secondary views.

### Pi SDK 0.80.3
- Upgraded to Pi agent SDK 0.80.3 (Claude Sonnet 5, gpt-5.5 default, provider/stream fixes).
- Displayed SDK version now reads from the SDK itself — no more drift after bumps.
- Reasoning/thinking token counts surfaced in the status bar cost tooltip where providers report them.

---

## v0.2.8 — June 22, 2026

### Security Fixes (P0)
- Fixed shell command injection in GitHub operations (execSync → execFileSync with arg arrays).
- Fixed command injection in package install/remove (removed `shell:true`).
- Fixed per-tab event misrouting: events without tabId are now dropped instead of defaulting to active tab.

---

## Homepage Hero — Key Milestones

Use these for the homepage hero or "What's new" callouts:

- **v0.3.0** — Open source 🎉
- **v0.3.1** — One-click in-app updates
- **v0.2.9** — Major performance overhaul (5s freezes eliminated, bundle halved)
- **v0.2.8** — Security audit remediation

---

## How to update this file

This file is generated from the in-app changelog at `src/renderer/src/components/settings/DesktopChangelog.tsx`. When you ship a new release, add the entry there first (so it shows in Settings → Changelog), then mirror it here for the website.
