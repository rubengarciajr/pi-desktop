# Pi Desktop - App Overview

## What is Pi Desktop?

Pi Desktop is a native macOS desktop application that wraps the [Pi coding agent](https://pi.dev) (`@earendil-works/pi-coding-agent` SDK) in a polished, multi-tab GUI. It replaces the terminal experience with a full-featured desktop app - no CLI required.

Built with **Electron 38**, **React 18**, **TypeScript**, and **Tailwind CSS**.

**Current version:** 0.2.8
**License:** MIT
**Platform:** macOS (Apple Silicon + Intel)
**Download:** [github.com/rubengarciajr/pi-desktop/releases](https://github.com/rubengarciajr/pi-desktop/releases)

---

## Core Concept

Pi is a minimal coding agent by earendil-works. It ships as a CLI tool that runs in the terminal. Pi Desktop takes the Pi SDK and runs it in-process inside an Electron app, giving users:

- A GUI chat interface with streaming responses
- Multi-tab parallel sessions (like browser tabs for AI coding)
- Full extension, skill, and package management
- GitHub integration
- Custom model configuration
- Theme system with accent colors

The app is **fully self-contained**. Users do not need Node.js, npm, or the Pi CLI installed to use it. The SDK runs inside the app's bundled Electron runtime.

---

## Key Features

### Multi-Tab Sessions
Run multiple independent Pi agent sessions simultaneously, each with its own:
- Working directory (cwd)
- Model and thinking level
- Session history and branching
- Extensions and skills context

Tabs work like browser tabs - create, switch, and close freely without losing session state.

### Streaming Chat Interface
- Real-time streaming responses with markdown rendering
- Syntax-highlighted code blocks
- Collapsible tool call/output blocks
- Diff viewer for file edits
- Image and PDF attachment support
- Smart auto-scroll that stays pinned while streaming or lets you scroll freely

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
- Per-folder repo linkage
- GitHub badge in the prompt area showing auth status

### Session Management
- Resume previous sessions
- Fork from any point in conversation history
- Clone current branch
- Favorites system
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
| Layer | Technology |
|---|---|
| Shell | Electron 38 (Chromium + Node.js 22) |
| Renderer | React 18 + TypeScript |
| Styling | Tailwind CSS 3 with CSS variables (RGB triplets for opacity support) |
| State | Zustand |
| Bundler | electron-vite (Vite) |
| AI SDK | @earendil-works/pi-coding-agent 0.79.10 |
| Build | electron-builder (DMG output) |
| CI | GitHub Actions (auto-build on tag push) |

### Process Architecture
```
+-------------------+     IPC (typed)     +-------------------+
|  Renderer (React) | <----------------> |  Main Process      |
|  - Chat UI        |    contextBridge    |  - SessionPool     |
|  - Settings       |    contextIsolation |  - PiSessionManager|
|  - Extensions     |    sandbox: false   |  - GitHub bridge   |
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

| Tool | Purpose |
|---|---|
| `read` | Read file contents |
| `bash` | Execute shell commands |
| `edit` | Edit files with fuzzy matching |
| `write` | Write/create files |
| `grep` | Search file contents |
| `find` | Find files by pattern |
| `ls` | List directory contents |

---

## Popular Extensions (User-Installable)

These are community packages that work seamlessly inside Pi Desktop:

| Package | What It Does |
|---|---|
| `@samfp/pi-memory` | Persistent memory across sessions - learns corrections, preferences, and patterns |
| `pi-subagents` | Delegate work to focused child agents (reviewer, planner, worker, scout, oracle) |
| `@narumitw/pi-plan-mode` | Codex-like plan mode - plan before executing |
| `pi-web-access` | Web search and content fetching for the agent |
| `context-mode` | Context management with semantic indexing |

Install via the Packages tab or Settings.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+M` | Switch models |
| `Cmd+N` | New session |
| `Cmd+L` | Focus prompt input |
| `Cmd+W` | Close tab (or window if last tab) |
| `Cmd+Shift+Enter` | Queue follow-up message during streaming |
| `Enter` | Send message (or select command from dropdown) |
| `Shift+Enter` | Newline |
| `Escape` | Dismiss command dropdown |
| Arrow keys | Navigate slash command autocomplete |

---

## Visual Design

### Layout
- **Left sidebar**: Navigation (Chat, Sessions, Extensions, Packages, Settings), version number, GitHub badge
- **Tab bar**: Horizontal tabs like a browser, each with its own session
- **Main area**: Chat messages with streaming, or the active settings panel
- **Status bar**: Working directory, model name, token usage (input/output/cache), cost, context window usage
- **Prompt area**: Auto-resizing textarea with slash command dropdown, Send/Steer/Stop buttons

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
curl -sL https://github.com/rubengarciajr/pi-desktop/releases/latest/download/Pi-Desktop-0.2.8.dmg -o /tmp/pidesktop.dmg && hdiutil attach /tmp/pidesktop.dmg -nobrowse -quiet && cp -R "/Volumes/Pi Desktop/Pi Desktop.app" /Applications/ && xattr -cr "/Applications/Pi Desktop.app" && hdiutil detach "/Volumes/Pi Desktop" -quiet && rm /tmp/pidesktop.dmg && open /Applications
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

| Path | Purpose |
|---|---|
| `~/.pi/agent/settings.json` | Global settings (packages, model, thinking level) |
| `~/.pi/agent/models.json` | Custom model definitions |
| `~/.pi/agent/auth.json` | API credentials |
| `~/.pi/agent/extensions/` | TypeScript extensions |
| `~/.pi/agent/skills/` | Skill directories with SKILL.md |
| `~/.pi/agent/prompts/` | Prompt templates |
| `~/.pi/agent/sessions/` | Session JSONL files |
| `~/.pi/agent/npm/node_modules/` | Installed npm packages |

---

## Repository

- **GitHub:** [rubengarciajr/pi-desktop](https://github.com/rubengarciajr/pi-desktop)
- **License:** MIT
- **Author:** Ruben Garcia Jr.
- **Powered by:** [Pi Coding Agent](https://pi.dev) by earendil-works
