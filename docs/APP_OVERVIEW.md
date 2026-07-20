# Pi Desktop - App Overview

## What is Pi Desktop?

Pi Desktop is a native macOS desktop application that wraps the [Pi coding agent](https://pi.dev) (`@earendil-works/pi-coding-agent` SDK) in a polished, multi-tab GUI. It replaces the terminal experience with a full-featured desktop app - no CLI required.

Built with **Electron 41**, **React 18**, **TypeScript**, and **Tailwind CSS**.

**Current version:** 0.6.2
**License:** MIT
**Platform:** macOS (Apple Silicon + Intel)
**Download:** [github.com/rubengarciajr/pi-desktop/releases](https://github.com/rubengarciajr/pi-desktop/releases)

---

## Core Concept

Pi is a minimal coding agent by earendil-works. It ships as a CLI tool that runs in the terminal. Pi Desktop takes the Pi SDK and runs it in-process inside an Electron app, giving users:

- A GUI chat interface with streaming responses
- **Quick Chat mode** — start talking instantly, no folder required (like Claude Desktop)
- **One-click "Convert to code"** — promote a chat into a real project session
- Multi-tab parallel sessions (like browser tabs for AI coding)
- Web search built in (toggle on per chat)
- Full extension, skill, and package management — with visual cues for extension modes (e.g. Plan Mode)
- GitHub integration with live "needs-sync" indicator
- Custom model configuration
- Per-session auto-compaction so long conversations never overflow
- Theme system with accent colors

The app is **fully self-contained**. Users do not need Node.js, npm, or the Pi CLI installed to use it. The SDK runs inside the app's bundled Electron runtime.

---

## Key Features

### Quick Chat Mode (no folder needed)

Launches straight into a ready-to-type **Chat** — no folder picker, like Claude Desktop. A **Chat / Code** toggle in the sidebar decides what "New" creates:

- **Chat** — instant, pure conversation. Runs in a throwaway scratch space with **no file/shell tools**, so it's safe and fast for brainstorming and questions.
- **Code** — pick a folder for a full project session with the agent's full toolset, Git, and GitHub.

Your choice is remembered between launches.

### ⚡ Convert to Code

Turn a chat into real work in one click. The **⚡ Convert to code** button (shown only in chat) lets you pick a folder; Pi Desktop then:

- Archives the whole conversation to `<folder>/docs/chat-<timestamp>.md` for reference
- Rebinds the session to that folder with full tools enabled
- **Seeds the new code session with the prior conversation** so the agent keeps full context

### Web Search

Search and fetch the web right from a conversation (powered by the `pi-web-access` package):

- A **🔍 Web** toggle in chat turns web search on/off **live** — no restart, conversation preserved
- Works **zero-config** with Exa (no API key)
- **Settings → Web Search** to add Exa / Perplexity / Gemini API keys and enable browser-cookie Gemini Web
- Always available in code-mode sessions

### Context & Compaction Control

Long conversations never blow past the context window:

- **Auto-compaction toggle** (per session) automatically summarizes old context before it overflows
- Live **context-usage readout** (turns amber as you approach the limit)
- **Compact now** button for manual control, or type **`/compact`** (and `/compact <instructions>`) right in the chat
- Each session compacts independently

### Multi-Tab Sessions

Run multiple independent Pi agent sessions simultaneously, each fully standalone with its own:

- Working directory (cwd) — or scratch space, in chat mode
- Model and thinking level (per session — switching one tab never changes another)
- Session history and branching
- Auto-compaction and web-search state
- Extensions and skills context

Tabs work like browser tabs - create, switch, and close freely without losing session state.

### Streaming Chat Interface

- Real-time streaming responses with markdown rendering
- Syntax-highlighted code blocks (compact, with a line-count hint and internal scroll — never overflows the window)
- Collapsible tool call/output blocks
- Diff viewer for file edits
- Image and PDF attachment support; **web images collapse to a tidy chip** you click to reveal (no more giant raw images)
- **True auto-scroll** — follows streaming output, but the moment you scroll up to read it stops fighting you, with a **"Jump to latest"** pill to snap back
- **Queue management** — remove a queued steering/follow-up message without stopping the running agent

### Extension UI (Plan Mode & more)

Extensions can drive rich, on-brand UI inside the app:

- **Plan Mode** shows a dedicated banner ("read-only · planning"), a status badge, and interactive menus
- Any extension's status badges, banners, prompts, and notifications render with a polished **generic "stock" look** for free — no per-extension theming required
- Interactive extension questions (select / confirm / input) appear as native modal dialogs

### Slash Commands

Type `/` in the prompt to see all available commands from:

- **Extension commands** (e.g., `/plan`, `/memory-consolidate`, `/run`)
- **Skills** (e.g., `/skill:pi-subagents`)
- **Prompt templates** (e.g., `/parallel-review`, `/review-loop`)

Arrow-key navigation with autocomplete. Commands load with retry/backoff to handle async extension initialization.

### Extension and Skill Management

- **Extensions tab** showing all loaded extensions, skills, commands, tools, and connectors
- **Remove individual skills** with hover-to-reveal Remove buttons
- **Restore to Stock** - one-click nuke button that removes all packages, extensions, skills, prompts, and themes, reverting to the 7 built-in tools
- **Package explorer** - browse, search, install, and remove Pi packages from the npm registry
- Skills, extensions, prompt templates, and themes all load from the user's `~/.pi/agent/` directory and installed npm packages

### Custom Model Management

- Inline "Add Model" form with quick presets for popular providers:
  - Claude (Anthropic)
  - Codex / GPT (OpenAI)
  - GLM (Z.ai)
  - MiniMax
  - MiMo (Xiaomi)
  - Grok (xAI)
- Models stored in `~/.pi/agent/models.json`
- Model picker with provider grouping and thinking level control (off, minimal, low, medium, high, xhigh)
- Per-tab model switching without losing session context

### Theme System

- **System / Dark / Light** mode with automatic macOS appearance detection
- **7 accent color presets**: Purple (default), Blue, Green, Orange, Pink, Teal, Red
- Theme preference persists across sessions
- System theme changes update in real-time
- Native macOS vibrancy (under-window blur effect)

### GitHub Integration

- Secure PAT authentication via Electron safeStorage (encrypted at rest)
- Create new repos from any folder
- Attach existing repos to local folders
- Push/pull with visual sync status (ahead/behind counts)
- Per-folder repo linkage, tracked **per session**
- GitHub badge in the prompt area that **glows when a session has uncommitted or unpushed changes** — a clear "needs sync" cue that updates automatically as the agent edits files

### Session Management

- Resume previous sessions
- Fork from any point in conversation history
- Clone current branch
- Favorites system — clicking a favorite opens it and auto-closes the Sessions panel
- Sessions organized by working directory
- Session tree navigation (jump to any point, continue from there)
- In-memory message cache for instant tab switching

### Package Installation

- Browse the Pi package registry (npm)
- One-click install/remove
- SDK-based installation using `DefaultPackageManager.installAndPersist()` - no CLI needed
- Installed packages and their resources (extensions, skills, prompts, themes) load automatically

### System Panel

- Dependency checker (Node.js, npm, Git, Pi CLI)
- One-click Pi CLI installer
- Copyable quick-start commands
- Links to pi.dev documentation
- Models.json location display

### Update Checker

- GitHub API-based version checking (not electron-updater)
- Toast banner when a new version is available
- Direct download link to latest release

---

## Architecture

### Technology Stack

| Layer    | Technology                                                           |
| -------- | -------------------------------------------------------------------- |
| Shell    | Electron 41 (Chromium 146 + Node.js 24)                              |
| Renderer | React 18 + TypeScript                                                |
| Styling  | Tailwind CSS 3 with CSS variables (RGB triplets for opacity support) |
| State    | Zustand                                                              |
| Bundler  | electron-vite (Vite)                                                 |
| AI SDK   | @earendil-works/pi-coding-agent 0.80.10                              |
| Build    | electron-builder (DMG output)                                        |
| CI       | GitHub Actions (auto-build on tag push)                              |

### Process Architecture

```
+-------------------+     IPC (typed)     +-------------------+
|  Renderer (React) | <----------------> |  Main Process      |
|  - Chat UI        |    contextBridge    |  - SessionPool     |
|  - Settings       |    contextIsolation |  - PiSessionManager|
|  - Extensions     |    sandbox: true    |  - GitHub bridge   |
|  - Packages       |                     |  - Tray icon       |
+-------------------+                     |  - Auto-updater    |
                                          +-------------------+
                                                    |
                                                    v
                                          +-------------------+
                                          |  Pi SDK (in-proc) |
                                          |  - AgentSession   |
                                          |  - ResourceLoader |
                                          |  - Extensions     |
                                          |  - PackageManager |
                                          +-------------------+
```

### Key Design Decisions

- **SDK runs in-process**: No `pi` CLI subprocess needed. The `createAgentSessionRuntime` SDK API runs inside Electron's main process.
- **Per-tab session isolation**: Each tab gets its own `PiSessionManager` with independent runtime, session, and event stream.
- **SharedDepsCache**: AuthStorage, ModelRegistry, and SettingsManager are cached and shared across tabs for fast tab creation.
- **MessageCache**: In-memory message cache for instant session switching without refetching.
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, Content-Security-Policy, all shell commands use `execFileSync` with arg arrays (no shell injection).

---

## The 7 Built-In Tools

Pi ships with these tools available to the AI agent out of the box:

| Tool    | Purpose                        |
| ------- | ------------------------------ |
| `read`  | Read file contents             |
| `bash`  | Execute shell commands         |
| `edit`  | Edit files with fuzzy matching |
| `write` | Write/create files             |
| `grep`  | Search file contents           |
| `find`  | Find files by pattern          |
| `ls`    | List directory contents        |

---

## Popular Extensions (User-Installable)

These are community packages that work seamlessly inside Pi Desktop:

| Package                  | What It Does                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| `@samfp/pi-memory`       | Persistent memory across sessions - learns corrections, preferences, and patterns |
| `pi-subagents`           | Delegate work to focused child agents (reviewer, planner, worker, scout, oracle)  |
| `@narumitw/pi-plan-mode` | Codex-like plan mode - plan before executing                                      |
| `pi-web-access`          | Web search and content fetching for the agent                                     |
| `context-mode`           | Context management with semantic indexing                                         |

Install via the Packages tab or Settings.

---

## Keyboard Shortcuts

| Shortcut          | Action                                         |
| ----------------- | ---------------------------------------------- |
| `Cmd+M`           | Switch models                                  |
| `Cmd+N`           | New session                                    |
| `Cmd+L`           | Focus prompt input                             |
| `Cmd+W`           | Close tab (or window if last tab)              |
| `Cmd+Shift+Enter` | Queue follow-up message during streaming       |
| `Enter`           | Send message (or select command from dropdown) |
| `Shift+Enter`     | Newline                                        |
| `Escape`          | Dismiss command dropdown                       |
| Arrow keys        | Navigate slash command autocomplete            |

---

## Visual Design

### Layout

- **Left sidebar**: Navigation (Chat, Sessions, Extensions, Packages, Settings), version number, GitHub badge
- **Tab bar**: Horizontal tabs like a browser, each with its own session
- **Main area**: Chat messages with streaming, or the active settings panel
- **Status bar**: Working directory (or a "Chat" pill in chat mode), model name, token usage, cost, live context-window usage
- **Prompt area**: Auto-resizing textarea with slash command dropdown, Send/Steer/Stop buttons, removable queue chips, and — in chat mode — the **🔍 Web** toggle and **⚡ Convert to code** button

### Logo

Custom Pi logo SVG with two-tone coloring:

- The "P" body uses `var(--color-text-rgb)` (adapts to dark/light theme)
- The "i" dot uses `var(--color-accent-rgb)` (changes with accent color selection)

### Color System

CSS variables using RGB triplets (e.g., `--color-accent-rgb: 124 92 255`) so Tailwind opacity modifiers (`bg-accent/10`) work correctly. Theme and accent selection via `data-theme` and `data-accent` attributes on `<html>`.

---

## Installation

### For End Users

Download the DMG from [GitHub Releases](https://github.com/rubengarciajr/pi-desktop/releases) and drag to Applications. If macOS shows a security warning:

```bash
xattr -cr "/Applications/Pi Desktop.app"
```

Or use the one-liner:

```bash
DMG_URL=$(curl -s https://api.github.com/repos/rubengarciajr/pi-desktop/releases/latest | grep "browser_download_url.*dmg" | cut -d '"' -f 4) && MOUNT_DIR="$(mktemp -d)" && curl -sL "$DMG_URL" -o /tmp/pidesktop.dmg && hdiutil attach /tmp/pidesktop.dmg -nobrowse -quiet -mountpoint "$MOUNT_DIR" && cp -R "$MOUNT_DIR/Pi Desktop.app" /Applications/ && xattr -cr "/Applications/Pi Desktop.app" && hdiutil detach "$MOUNT_DIR" -quiet && rmdir "$MOUNT_DIR" && rm /tmp/pidesktop.dmg && open /Applications
```

### For Developers

```bash
git clone https://github.com/rubengarciajr/pi-desktop.git
cd pi-desktop
npm install
npm run dev
```

---

## Configuration

Pi Desktop reads from the standard Pi configuration directory:

| Path                            | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `~/.pi/agent/settings.json`     | Global settings (packages, model, thinking level) |
| `~/.pi/agent/models.json`       | Custom model definitions                          |
| `~/.pi/agent/auth.json`         | API credentials                                   |
| `~/.pi/agent/extensions/`       | TypeScript extensions                             |
| `~/.pi/agent/skills/`           | Skill directories with SKILL.md                   |
| `~/.pi/agent/prompts/`          | Prompt templates                                  |
| `~/.pi/agent/sessions/`         | Session JSONL files                               |
| `~/.pi/agent/npm/node_modules/` | Installed npm packages                            |

---

## Repository

- **GitHub:** [rubengarciajr/pi-desktop](https://github.com/rubengarciajr/pi-desktop)
- **License:** MIT
- **Author:** Ruben Garcia Jr.
- **Powered by:** [Pi Coding Agent](https://pi.dev) by earendil-works
