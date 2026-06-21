# Pi Desktop

A full-featured macOS desktop app for the [Pi coding agent](https://pi.dev). Built with Electron, React, and TypeScript.

Pi Desktop brings the power of the Pi AI coding agent into a native macOS experience with streaming chat, multi-tab sessions, custom model management, GitHub integration, and automatic updates. No terminal required.

**[Download the latest release](https://github.com/rubengarciajr/pi-desktop/releases)**

---

## Features

### Chat Experience
- **Streaming responses** with markdown rendering, syntax highlighting, and collapsible tool output
- **Multi-tab sessions** - run multiple independent pi agents in parallel, each with its own working directory, model, and session state
- **Slash command autocomplete** with arrow-key navigation for commands, skills, and prompt templates
- **Smart scroll tracking** that stays pinned to the latest message or lets you scroll freely through history
- **Follow-up messages** - steer the agent mid-stream without waiting for completion

### Model Management
- **Built-in model picker** with provider grouping and reasoning level control
- **Add custom models** from the UI - no terminal or JSON editing needed. Supports:
  - Claude (Anthropic)
  - Codex / OpenAI
  - Z.ai (GLM)
  - MiniMax
  - Xiaomi MiMo
  - Grok (xAI)
  - Any OpenAI-compatible, Anthropic, or Google AI endpoint
- **Quick presets** fill the form with correct base URLs and API types
- **Thinking level control** (off, minimal, low, medium, high, xhigh)
- **Per-tab model selection** - different tabs can use different models

### Session Management
- **Session browser** with resume, fork, clone, and favorites
- **Folder organization** for grouping related sessions
- **Session tree view** showing fork history and relationships
- **Instant tab switching** with in-memory message caching

### GitHub Integration
- **PAT authentication** with avatar and username display
- **Repository management** - create, attach, push, and pull repos per folder
- **Per-folder repo linkage** with status badges in the prompt bar
- **Clone repositories** directly into a new session

### Extensions and Packages
- **Extensions browser** with tabs for extensions, skills, commands, and tools
- **Package explorer** - search, install, and remove pi packages from npm
- **Argument hints** for commands and skills

### System Integration
- **Native macOS menu bar** tray icon with quick actions
- **Auto-updates** - the app checks for new versions on launch and downloads them in the background. A toast banner appears when an update is ready to install
- **PATH repair** for GUI launches - automatically detects Homebrew, nvm, Volta, and fnm paths
- **Pi CLI installer** built into the System tab for users who don't have the terminal app
- **Drag-to-install DMG** with custom Pi app icon

### Performance
- **SharedDepsCache** - caches AuthStorage, ModelRegistry, and SettingsManager across tabs for fast session creation
- **MessageCache** - instant session switching with in-memory message caching
- **Lazy state emission** - only sends state updates when values change

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+M` | Switch models |
| `Cmd+N` | New session |
| `Cmd+L` | Focus prompt |
| `Cmd+W` | Close tab (or window if last tab) |
| `Cmd+Shift+Enter` | Send follow-up during streaming |
| `Enter` | Send message (or select slash command) |
| `Shift+Enter` | Newline |
| `Up/Down + Enter` | Slash command autocomplete navigation |

---

## Installation

### Quick Install (Terminal)
Paste this one command into Terminal to download, install, and remove the Gatekeeper quarantine flag automatically:

```bash
curl -sL https://github.com/rubengarciajr/pi-desktop/releases/latest/download/Pi-Desktop-0.1.2.dmg -o /tmp/pidesktop.dmg && hdiutil attach /tmp/pidesktop.dmg -nobrowse -quiet && cp -R "/Volumes/Pi Desktop 0.1.2/Pi Desktop.app" /Applications/ && xattr -cr "/Applications/Pi Desktop.app" && hdiutil detach "/Volumes/Pi Desktop 0.1.2" -quiet && rm /tmp/pidesktop.dmg && open /Applications
```

### Manual Download
Download the latest DMG from the [Releases page](https://github.com/rubengarciajr/pi-desktop/releases).

### macOS Gatekeeper Note
Pi Desktop is ad-hoc signed but not notarized (no Apple Developer certificate). If macOS blocks it:

**Option A (recommended):**
1. Drag Pi Desktop to your Applications folder
2. Right-click **Pi Desktop** and select **Open**
3. Click **Open** in the dialog that appears
4. It will open normally from now on

**Option B:**
1. Drag Pi Desktop to your Applications folder
2. Open **System Settings > Privacy & Security**
3. Scroll down and click **"Open Anyway"** next to the Pi Desktop message

**Option C (Terminal):**
```bash
xattr -cr "/Applications/Pi Desktop.app"
```

### Build from Source

```bash
git clone https://github.com/rubengarciajr/pi-desktop.git
cd pi-desktop
npm install
npm run dev
```

### Build DMG

```bash
npm run build:dmg
```

---

## Tech Stack

- **Electron 38** - cross-platform desktop runtime
- **React 18 + TypeScript** - renderer UI
- **electron-vite** - build tooling and HMR
- **Tailwind CSS** - styling
- **Zustand** - state management
- **electron-updater** - auto-updates via GitHub Releases
- **Pi SDK** (`@earendil-works/pi-coding-agent`) - in-process agent runtime

---

## Architecture

```
src/
  main/              # Electron main process
    pi/              # Pi SDK integration
      PiSessionManager.ts   # Per-tab session lifecycle
      SessionPool.ts        # Multi-tab manager
      SharedDepsCache.ts     # Cached stateless deps
      MessageCache.ts        # In-memory message cache
    models.ts        # Custom models.json management
    updater.ts       # Auto-update logic
    installer.ts     # Pi CLI installer
    ipc.ts           # IPC handler registry
    fix-path.ts      # macOS GUI PATH repair
  preload/           # Context bridge (window.pi API)
  renderer/          # React UI
    components/
      chat/          # Chat view, prompt input, message rendering
      model/         # Model picker + custom model form
      sessions/      # Session browser
      settings/      # Settings, System, Changelogs
      extensions/    # Extensions/skills/commands browser
      packages/      # npm package explorer
  shared/            # Shared types (IPC contracts)
resources/           # App icons, tray icon, entitlements
```

---

## Adding Custom Models

Custom models are stored in `~/.pi/agent/models.json` and hot-reload without restarting the app.

### From the UI
1. Open the **Model** tab
2. Click **+ Add Model**
3. Pick a quick preset or fill in the form manually
4. The model appears in your available models list

### Supported API Types
| API | Use For |
| --- | --- |
| `openai-completions` | OpenAI, Ollama, vLLM, LM Studio, most providers |
| `anthropic-messages` | Anthropic, Anthropic-compatible proxies |
| `google-generative-ai` | Google AI Studio, Gemini |

### API Key Formats
- **Direct key**: `sk-ant-...`
- **Environment variable**: `$MY_API_KEY`
- **Shell command**: `!security find-generic-password -ws 'anthropic'`

---

## Releasing Updates

1. Bump `version` in `package.json`
2. Commit and tag: `git tag v0.X.0 && git push origin v0.X.0`
3. GitHub Actions automatically builds the DMG and publishes a Release
4. Running apps detect the update, download it, and prompt the user to restart

---

## License

MIT
