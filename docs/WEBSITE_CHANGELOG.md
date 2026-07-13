# Pi Desktop — Website Changelog

> **Source of truth for pi-desktop.dev.**
> Current version: **v0.5.8** · Last updated: **July 13, 2026**
> Copy directly into the website's changelog section.

---

## v0.5.8 — July 13, 2026

### Pi Routing — now you can see what each agent said
- **Per-agent report card.** After every Pi Routing run, a collapsible card appears in the chat showing each team member's full response, confidence score, and the synthesized briefing. Expand individual agents or everything at once — full transparency into what your multi-agent team contributed.
- **Real-time per-agent progress.** Instead of a generic "Consulting 3 models…" you now see which models have finished ("2/3 models responded") as each one completes.
- **Branded status bar indicator.** The bottom-right of the window shows the Pi Routing icon in the app brand color with live progress while routing, and the confidence score after completion. The tab bar also gets a pulsing routing icon so you can instantly spot which tab is running multi-agent work.

---

## v0.5.7 — July 13, 2026

### Sidebar
- **Mixture of Agents (Pi Routing) is now a top-level sidebar item**, sitting right below Tag Team. It's no longer buried inside Settings — both multi-model features are now side by side where you expect them.

---

## v0.5.6 — July 13, 2026

### Pi Routing — now works in the installed app
- **Fixed.** Pi Routing (Mixture of Agents) was failing in the packaged app with "Could not locate pi-ai/compat." The root cause: electron-builder flattens npm dependencies inside the asar bundle, so the compat module moved from a nested path to a top-level path. The engine now checks both layouts and uses `createRequire` to load from inside the asar — MOA and Tag Team both work in the installed DMG now.

### Streaming freeze fix
- **The UI no longer freezes after a model finishes.** A coding session on AgentMail revealed that when the model completed normally, the "Thinking..." indicator could stay forever and the input stayed disabled — because `isStreaming: false` was set in only one event handler with no fallback. Now streaming resets on three independent signals: the message-end event with a terminal stop reason, backend state pushes, and a 30-second watchdog that force-resets any stuck tab. A single missed event can never freeze the app again.

---

## v0.5.5 — July 11, 2026

### Fixes
- **Tag Team final handoff** — the handoff prompt configured on your last stage is now actually used. Previously the final model received a generic instruction and your prompt was ignored.
- **Pi Routing** — the aggregator now uses your configured confidence threshold instead of a placeholder value.
- **Slash-containing model IDs** — models whose ID contains a `/` (e.g. OpenRouter's `anthropic/claude-sonnet-4`) now select correctly.
- **Update checks** — version comparison now handles tagged and pre-release versions correctly instead of silently failing.

### Improvements
- **New "max" thinking level** in the model and status-bar pickers.
- **Faster code blocks** — syntax highlighting now loads on demand, trimming the initial load.
- **Platform & security** — upgraded to Electron 41 and Vite 6 (modern Chromium, faster builds), removed the build-time update token from the distributed binary, and hardened the in-app updater's download-URL validation.

---

## v0.5.4 — July 9, 2026

### Models
- **New Codex models** — **GPT-5.6 Luna**, **GPT-5.6 Sol**, and **GPT-5.6 Terra** are now available with your ChatGPT sign-in, via the Pi SDK 0.80.5 upgrade. They appear in the model switcher (⌘M) automatically.
- **Claude Sonnet 5 via Copilot** — Sonnet 5 was added to the GitHub Copilot model catalog.

### Reliability
- **Long Codex sessions stay connected** — connections now rotate before the backend's 60-minute limit, so marathon sessions no longer fail mid-stream.
- **Copilot sign-in fix** — device-code login no longer appears to hang after you authorize in the browser.

---

## v0.5.3 — July 9, 2026

### Models
- **New models pull in the moment you connect** — signing in or out of a provider (like Codex) now refreshes the model list live, so newly available models appear immediately without an app restart. The ⌘M switcher stays in sync too.
- **Claude Sonnet 5 preset** — the "Add Model" template for Anthropic now defaults to Claude Sonnet 5.

### Editing & Interface
- **Open in external editor** — a new button in the prompt bar opens your draft in your editor of choice (e.g. VS Code with `code --wait`), waits while you edit, and pulls the result back in. Configure the command in **Settings → Appearance**. Works in both chat and code sessions.
- **Message spacing** — a new **Compact / Comfortable / Spacious** control in Settings → Appearance tunes the horizontal padding around messages.
- **Live session names** — a tab's title now updates the moment its session is renamed.

---

## v0.5.2 — July 9, 2026

### Routing & Tag Team
- **Cleaner toggles** — the Pi Routing and Tag Team buttons show just their icon until you activate a team, then show the team's name.
- **Available in code sessions** — both now appear after you open a folder, not only in chat, so you can route or run a relay while coding.

---

## v0.5.1 — July 9, 2026

### Tag Team
- **New icon** — Tag Team now uses its dedicated collaboration icon everywhere it appears: the sidebar, the chat toolbar, handoff tabs, and the Tag Team panel.

---

## v0.5.0 — July 9, 2026

### Tag Team — Sequential Model Relay
- **A new way to combine models.** Tag Team is the opposite of Mixture of Agents: instead of running models in parallel, models work **sequentially**. The starter model (e.g. Minimax M3) builds out your idea, then **tags** the next model (e.g. Codex 5.5), which takes over in a new tab and improves the work — automatically, with no clicks needed.
- **Custom handoff prompts.** Each stage carries a prompt that tells the next model what to do: "Review the code above and fix any bugs," "Optimize for performance," "Add tests." You write the instructions once and every relay uses them.
- **Saves context window.** Each model gets its own fresh tab with only what it needs — Model B carries Model A's output and the handoff prompt, not the entire conversation history.
- **Full team management.** The new **Tag Team** sidebar panel lets you build teams with 2+ stages, set each stage's model and role, reorder stages, write handoff prompts, and test the relay before using it. Create as many teams as you want and cycle through them from the chat toolbar.
- **TAG badges in the tab bar** show at a glance which tabs are relay handoffs.
- **Relays all the way through.** A team isn't capped at two models — each stage hands off to the next until the finalizer, so a **build → review → finalize** team runs end-to-end on its own.

### Pi Routing (Mixture of Agents)
- The toolbar toggle now shows the **team name** instead of the word "Routing," so you always see what's active at a glance.

---

## v0.4.8 — July 9, 2026

### Pi Routing — Mixture of Agents
- **MOA now works** — fixed a packaging bug (ERR_PACKAGE_PATH_NOT_EXPORTED) that prevented the Mixture of Agents engine from loading the model-calling layer. Team fan-out, aggregation, and the advanced score-and-re-query loop all run now.
- **Test before you save** — the Test button in the team editor runs against your in-progress draft, so you can iterate on a team without saving it first. Previously it threw "Team not found."
- **Clearer model selection** — each team member row shows a colored provider badge and an accent border the moment you pick a model, so you can see the team's makeup at a glance. Dropdown chevrons are now cleanly spaced with a custom arrow.

---

## v0.4.7 — July 8, 2026

### Custom Models
- **Fixes apply to all your models at once** — you no longer have to open and re-save each model to pick up a fix; repairs run automatically on launch. And editing a model's API key now takes effect immediately, without a restart.

---

## v0.4.6 — July 8, 2026

### Custom Models
- **Fixed: "No API key" when picking a new local model** — a local model you'd just added could show in the switcher but fail to select. It now works immediately, with no restart. Local models still don't need a real API key.

---

## v0.4.5 — July 8, 2026

### Custom Models
- **Fixed: local models could stay hidden** — a local model added without an API key wasn't showing in the model switcher. Local servers now get a harmless placeholder key automatically, so they appear right away. (If you already hit this, just re-save the model.)

---

## v0.4.4 — July 8, 2026

### Custom Models
- **Changes apply instantly** — models you add, edit, or remove now show up in the model switcher (⌘M) right away, with no new tab or restart needed.

---

## v0.4.3 — July 8, 2026

### Custom Models
- **See what a local server offers** — Test connection now lists the models available on the server as clickable chips. Click one to fill in the Model ID — no more guessing the exact name.

---

## v0.4.2 — July 8, 2026

### Custom Models
- **Edit a custom model** — made a typo in the URL or model name? You can now edit any custom model in place instead of removing it and starting over. Leave the API key blank to keep the current one.

---

## v0.4.1 — July 8, 2026

### Local Models
- **Connect a local model in two clicks** — a new **Local** preset in the Add Model form fills in a localhost template for Ollama, LM Studio, or llama.cpp, so you don't have to remember the endpoint.
- **Test connection** — a new button pings your local server before you save, confirming it's reachable and that your chosen model is available. No more guessing why a model isn't showing up.

---

## v0.4.0 — July 8, 2026

### 🧠 Pi Routing — Mixture of Agents (Pi Desktop Exclusive)

A first-of-its-kind feature for the Pi ecosystem. Create a **team of models** that collaborate on your prompts in parallel, synthesize their insights into a briefing, and let the main model build its response enriched by the team's analysis.

- **Team-based routing**: Pick any combination of your configured models (Claude, GPT, GLM, Grok, etc.) to form a team. Each prompt fans out to all members simultaneously — their responses are aggregated into an enriched context briefing that the main model uses to build a better answer.
- **Basic mode**: Single-pass — the team responds once, the aggregator synthesizes, the main model builds. Fast and cost-effective.
- **Advanced mode**: The aggregator scores each team member's response (0–10). Low-scoring members are automatically re-queried with refined prompts (up to 5 layers). You can also trigger a manual re-query, and confidence scores are visible in the chat.
- **New "Mixture of Agents" settings tab** with team CRUD, member/aggregator model selection, a built-in test runner, and advanced tuning (max layers, confidence threshold, visibility toggles).
- **Pi Routing button** in the chat toolbar (next to Tools and Web) — toggle it on, pick a team, and every prompt is pre-processed by the team.
- **Live progress indicator** shows "Pi Routing: consulting N models…" during fan-out, so you know the team is working.
- The routing icon adapts to dark/light themes automatically.

### Sessions Panel

- **Session cards** — sessions are now bordered cards instead of flat rows, with clear visual hierarchy and the active session highlighted with an accent border and "current" label.
- **Panel separation** — the sessions panel background is now fully distinct from the main chat area.

---

## v0.3.8 — July 8, 2026

### Sessions Panel
- Sessions are now cards with clear borders instead of flat rows — easier to scan and distinguish from the panel background.
- The session you're currently in is highlighted with an accent border, glow ring, and "current" label.
- The folder you're working in is marked with accent color in the folder header and favorites list.
- Panel background is now fully separated from the main chat area with a stronger divider.

---

## v0.3.7 — July 7, 2026

### Features
- **Interactive file paths** — click any file path in the conversation (in a message, a tool call, or command output) to open it in Finder or copy it. The menu offers **Reveal in Finder**, **Copy full path**, **Copy filename**, and **Copy relative path** — a quick way to jump from what Pi is doing to the actual files.

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

- **v0.4.0** — Pi Routing: Mixture of Agents 🧠 (Pi Desktop exclusive)
- **v0.3.0** — Open source 🎉
- **v0.3.1** — One-click in-app updates
- **v0.2.9** — Major performance overhaul (5s freezes eliminated, bundle halved)
- **v0.2.8** — Security audit remediation

---

## How to update this file

This file is generated from the in-app changelog at `src/renderer/src/components/settings/DesktopChangelog.tsx`. When you ship a new release, add the entry there first (so it shows in Settings → Changelog), then mirror it here for the website.
