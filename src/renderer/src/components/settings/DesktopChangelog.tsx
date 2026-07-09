interface DesktopChangelogEntry {
  version: string;
  date: string;
  sections: { title: string; items: string[] }[];
}

const CHANGELOG: DesktopChangelogEntry[] = [
  {
    version: "0.5.2",
    date: "2026-07-09",
    sections: [
      {
        title: "Routing & Tag Team",
        items: [
          "The Pi Routing and Tag Team toolbar buttons now show just their icon until you activate a team — then they show the team's name",
          "Both toggles are now available in code sessions too, not only in chat — so you can route or run a relay after opening a folder",
        ],
      },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-07-09",
    sections: [
      {
        title: "Tag Team",
        items: [
          "Tag Team now uses the collaboration icon everywhere it appears — the sidebar panel, the chat toolbar toggle, handoff tabs, and the Tag Team settings view",
        ],
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-09",
    sections: [
      {
        title: "Tag Team — Sequential Model Relay",
        items: [
          "New feature: Tag Team lets models work sequentially. The starter model builds out your idea, then tags the next model, which takes over in a new tab and improves the work — automatically, no clicks needed",
          "Each stage can carry a custom handoff prompt so the next model knows exactly what to do (e.g. 'Review the code above and improve it')",
          "Full team management in the new Tag Team sidebar panel: create teams with 2+ stages, set each stage's model and role, reorder stages, write handoff prompts, and test the relay before using it",
          "Chat toolbar button cycles through your teams on click and shows the active team name",
          "Tag Team tabs show a 'TAG' badge so you can tell at a glance which tabs are relay handoffs",
          "A new tab opens for each handoff to save context window — Model B only carries what it needs, not the entire session history",
        ],
      },
      {
        title: "Pi Routing (MOA)",
        items: [
          "The toolbar toggle now shows the team name instead of the word 'Routing', so you always see what's active at a glance",
        ],
      },
    ],
  },
  {
    version: "0.4.8",
    date: "2026-07-09",
    sections: [
      {
        title: "Pi Routing — Mixture of Agents",
        items: [
          "Fixed MOA failing with ERR_PACKAGE_PATH_NOT_EXPORTED — the engine now resolves the pi-ai compat module by direct file path, bypassing the nested package exports map that blocked the old import",
          "Fixed the Test button throwing \"Team not found\" — unsaved team drafts can now be tested directly from the editor before saving",
          "Fixed dropdown chevron spacing and contrast — selects now use a clean custom arrow with consistent right padding",
          "Selected models in the team editor are now visible at a glance: each row shows a colored provider badge and an accent border when a model is picked",
          "Team cards in the list now show model chips for every member plus the aggregator, so the team's makeup is readable without opening the editor",
        ],
      },
    ],
  },
  {
    version: "0.4.7",
    date: "2026-07-08",
    sections: [
      {
        title: "Custom Models",
        items: [
          "Model fixes now apply to all your models automatically on launch — no need to open and re-save each one",
          "Editing a model's API key now takes effect immediately in the running session, without a restart",
        ],
      },
    ],
  },
  {
    version: "0.4.6",
    date: "2026-07-08",
    sections: [
      {
        title: "Custom Models",
        items: [
          "Fixed the \"No API key\" error when selecting a local model that had just been added — local models are now selectable immediately, without restarting. (Local servers still don't need a real key; Pi registers a harmless placeholder automatically.)",
        ],
      },
    ],
  },
  {
    version: "0.4.5",
    date: "2026-07-08",
    sections: [
      {
        title: "Custom Models",
        items: [
          "Fixed local models not appearing in the switcher when added with a blank API key — a localhost server now stores a harmless placeholder key instead of the unresolved $API_KEY that the model list was hiding. Re-saving an affected model fixes it",
        ],
      },
    ],
  },
  {
    version: "0.4.4",
    date: "2026-07-08",
    sections: [
      {
        title: "Custom Models",
        items: [
          "Added, edited, and removed custom models now appear in the model switcher (Cmd+M) immediately — no more needing to open a new tab or restart the app",
        ],
      },
    ],
  },
  {
    version: "0.4.3",
    date: "2026-07-08",
    sections: [
      {
        title: "Custom Models",
        items: [
          "Test connection now lists the models the server actually offers — click one to fill in the Model ID (handy when your model name doesn't match, e.g. it showed \"gemme4:e2b isn't in the list\")",
        ],
      },
    ],
  },
  {
    version: "0.4.2",
    date: "2026-07-08",
    sections: [
      {
        title: "Custom Models",
        items: [
          "You can now Edit a custom model, not just remove it — fix a typo in the base URL, model ID, provider name, API type, or context window without deleting and re-adding. Leave the API key blank to keep the current one",
        ],
      },
    ],
  },
  {
    version: "0.4.1",
    date: "2026-07-08",
    sections: [
      {
        title: "Local Models",
        items: [
          "New 'Local' quick preset in Add Model — fills a localhost template (Ollama / LM Studio / llama.cpp) so you can connect a local model without typing the endpoint by hand",
          "New 'Test connection' button that pings the endpoint before you save — confirms the server is reachable and whether your model ID is available",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-08",
    sections: [
      {
        title: "Pi Routing — Mixture of Agents",
        items: [
          "Pi Desktop exclusive: create teams of models that collaborate on your prompts in parallel, synthesize a briefing, and let the main model build its response enriched by the team's analysis",
          "New Pi Routing button in the chat toolbar (next to Tools and Web) — toggle it on, pick a team, and every prompt is pre-processed by the MOA team before the main model responds",
          "Basic mode: team fans out once per prompt, aggregator synthesizes, main model builds — single layer",
          "Advanced mode: aggregator scores each team response (0–10); low-scoring members are automatically re-queried with refined prompts (up to 5 layers), with manual re-query support",
          "New 'Mixture of Agents' settings tab with team CRUD, member/aggregator model selection, test runner, and advanced tuning (max layers, confidence threshold, visibility toggles)",
          "Pi Routing icon adapts to dark/light themes automatically via currentColor",
          "Live progress indicator in the chat area shows 'Pi Routing: consulting N models…' during fan-out",
        ],
      },
    ],
  },
  {
    version: "0.3.8",
    date: "2026-07-08",
    sections: [
      {
        title: "Sessions Panel",
        items: [
          "Sessions are now cards with clear borders instead of flat rows — easier to scan and distinguish from the panel background",
          "The session you're currently in is highlighted with an accent border, glow ring, and a 'current' label, so you always know where you are",
          "The folder you're working in is also marked with accent color in the folder header and favorites list",
          "Panel background is now fully separated from the main chat area with a stronger divider",
        ],
      },
    ],
  },
  {
    version: "0.3.7",
    date: "2026-07-07",
    sections: [
      {
        title: "Features",
        items: [
          "File paths in the conversation are now interactive — click any path (in a message, a tool call, or command output) to Reveal in Finder, Copy full path, Copy filename, or Copy path relative to the working folder",
        ],
      },
    ],
  },
  {
    version: "0.3.6",
    date: "2026-07-07",
    sections: [
      {
        title: "Fixes",
        items: [
          "Opening a conversation now starts at the most recent message (scrolled to the bottom) instead of the oldest — noticeable when opening a favorite or a saved session",
        ],
      },
    ],
  },
  {
    version: "0.3.5",
    date: "2026-07-07",
    sections: [
      {
        title: "Fixes",
        items: [
          "Favorites now persist across restarts and app updates — they're saved to a file in the app's data folder instead of browser storage that didn't survive relaunches (your existing favorites are migrated over automatically)",
        ],
      },
    ],
  },
  {
    version: "0.3.4",
    date: "2026-07-07",
    sections: [
      {
        title: "Fixes",
        items: [
          "One tab per folder: opening a folder that's already open now focuses the existing tab instead of opening a duplicate — applies across the Sessions list, favorites, the + tab button, drag-and-drop, the sidebar, and the macOS New Session menu",
          "The working-folder path at the top of a chat is now clickable — click it to open the folder in Finder",
        ],
      },
    ],
  },
  {
    version: "0.3.3",
    date: "2026-07-06",
    sections: [
      {
        title: "Critical Fix",
        items: [
          "Fixed crash-on-launch on Apple Silicon: the in-app update downloader now strips the macOS quarantine flag from the downloaded DMG before opening it, so the updated app launches cleanly instead of being killed by Gatekeeper",
        ],
      },
    ],
  },
  {
    version: "0.3.2",
    date: "2026-07-06",
    sections: [
      {
        title: "Fixes",
        items: [
          '"Start Chatting" now reuses the current tab instead of opening a duplicate — the prompt focuses immediately so you can start typing',
          "Glowing accent border on the chat input now appears reliably on every empty chat (no longer requires a restart)",
        ],
      },
    ],
  },
  {
    version: "0.3.1",
    date: "2026-07-06",
    sections: [
      {
        title: "Update UX",
        items: [
          'The update banner now downloads the DMG in-app (no browser) with a live progress bar, then opens the installer in Finder ready to drag into Applications',
        ],
      },
      {
        title: "Fixes",
        items: [
          'Version badge in the sidebar is now single-sourced from package.json via the preload bridge — it can no longer drift out of sync',
          'The "Start Chatting" heading now focuses the prompt input so you can start typing immediately',
          'Install one-liners in the docs no longer hardcode a version — they resolve the latest asset from the GitHub API',
        ],
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-06",
    sections: [
      {
        title: "Public Release",
        items: [
          "Pi Desktop is now open source — the full codebase is public on GitHub",
          "In-app update check runs anonymously against the GitHub releases API (no token, no setup)",
          "Sidebar version badge is now sourced from package.json so it can never drift from the installed build",
        ],
      },
      {
        title: "Chat UX",
        items: [
          '"Start Chatting" is now a clean h2 heading instead of a button — click it to start a chat and the prompt focuses automatically',
          "Glowing accent border on the message input when a chat or code session is empty — draws the eye to where you type",
        ],
      },
      {
        title: "Releases",
        items: [
          "CI auto-publishes GitHub Releases (no more stuck drafts)",
          "Every release ships a fresh DMG with no baked-in credentials",
        ],
      },
    ],
  },
  {
    version: "0.2.9",
    date: "2026-07-04",
    sections: [
      {
        title: "Performance",
        items: [
          "Eliminated periodic 5-second UI freezes: git/GitHub polling and version probes moved off the main thread (execFileSync → async)",
          "Streaming chat no longer re-highlights code on every token — CodeBlock is memoized, markdown consts hoisted, message list virtualized (react-virtuoso)",
          "Renderer bundle cut from 1.7 MB to ~1.0 MB: PrismLight + selective language registration, vendor chunk splitting, lazy-loaded secondary views",
        ],
      },
      {
        title: "Pi SDK 0.80.3",
        items: [
          "Upgraded Pi agent SDK to 0.80.3 (Claude Sonnet 5, gpt-5.5 default, provider/stream fixes)",
          "Displayed SDK version now reads from the SDK itself — no more drift after bumps",
          "Reasoning/thinking token counts surfaced in the status bar cost tooltip where providers report them",
        ],
      },
      {
        title: "No-CLI cleanup",
        items: [
          "Removed the dead pi-CLI installer UI and the 'Install Pi' button — Pi Desktop runs the SDK in-process and never needed it",
          "Package install/remove/list now provably goes through the in-process SDK (dead CLI-spawning code in packages.ts removed)",
          "System tab reworded to make clear Node/npm are only needed when installing packages, and the Pi CLI is terminal-only",
          "Removed the unused Onboarding screen",
          "Fixed black screen on launch: preload now builds as CommonJS (sandboxed renderers don't support ESM imports)",
        ],
      },
    ],
  },
  {
    version: "0.2.8",
    date: "2026-06-22",
    sections: [
      {
        title: "Security Fixes (P0)",
        items: [
          "Fixed shell command injection in GitHub operations (execSync → execFileSync with arg arrays)",
          "Fixed command injection in package install/remove (removed shell:true)",
          "Fixed per-tab event misrouting: events without tabId are now dropped instead of defaulting to active tab",
          "Fixed Install Pi button: now actually calls startPiInstall()",
          "Removed shell:true from npm installer",
          "Clear token file properly (unlink instead of truncate)",
        ],
      },
    ],
  },
  {
    version: "0.2.7",
    date: "2026-06-22",
    sections: [
      {
        title: "Fixes",
        items: [
          "Fixed slash command dropdown staying open after selecting a command",
          "Enter now properly closes the dropdown and lets you type arguments or press Enter again to submit",
          "Escape now dismisses the dropdown without clearing your text",
        ],
      },
    ],
  },
  {
    version: "0.2.6",
    date: "2026-06-22",
    sections: [
      {
        title: "Features",
        items: [
          "Upgraded Pi SDK to 0.79.10",
          "Extension commands now load reliably with retry/backoff",
          "Commands refresh automatically when switching tabs or installing packages",
          "Skill removal and Restore to Stock now reload resources immediately",
        ],
      },
      {
        title: "Fixes",
        items: [
          "Fixed accent colors not switching (CSS :root was overriding [data-accent])",
          "Fixed logo 'i' dot invisible in light mode (now uses accent color)",
          "Fixed settingsManager not passed to session services (stale extensions)",
          "Dynamic app version in System panel (no longer hardcoded)",
        ],
      },
    ],
  },
  {
    version: "0.2.5",
    date: "2026-06-22",
    sections: [
      {
        title: "Features",
        items: [
          "Remove individual skills from the Skills tab (hover to reveal Remove button)",
          "Restore to Stock: nuke all packages, extensions, skills, prompts, and themes back to 7 built-in tools",
        ],
      },
      {
        title: "Fixes",
        items: [
          "Fixed light mode logo being invisible white (now uses currentColor)",
          "Fixed accent/theme colors not switching: CSS variables use RGB triplets for Tailwind opacity support",
          "Removed Updates section from Settings panel",
          "Dynamic app version in System panel (no longer hardcoded)",
        ],
      },
    ],
  },
  {
    version: "0.2.4",
    date: "2026-06-22",
    sections: [
      {
        title: "Fixes",
        items: [
          "Window now shows immediately on launch (show: true instead of waiting for ready-to-show)",
          "Resources directory included in app package (tray icon, app icons)",
          "Added error handlers for renderer load failures and crashes",
        ],
      },
    ],
  },
  {
    version: "0.2.3",
    date: "2026-06-22",
    sections: [
      {
        title: "Fixes",
        items: [
          "Window created before session pool init to prevent startup deadlock",
        ],
      },
    ],
  },
  {
    version: "0.2.2",
    date: "2026-06-21",
    sections: [
      {
        title: "Fixes",
        items: [
          "Removed electron-updater entirely (was causing 404 errors on startup)",
          "Fixed package install using require() in ESM context",
          "Fixed error overflow in package cards",
        ],
      },
    ],
  },
  {
    version: "0.2.1",
    date: "2026-06-21",
    sections: [
      {
        title: "Fixes",
        items: [
          "Fixed extension install failing silently (require() in ESM, switched to await import())",
          "Added error display in package cards",
        ],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-21",
    sections: [
      {
        title: "Features",
        items: [
          "Dark / Light mode with system appearance detection",
          "Accent color presets (Purple, Blue, Green, Orange, Pink, Teal, Red)",
          "In-app update checker with Download button",
          "Update banner that appears when a new version is available",
        ],
      },
      {
        title: "Fixes",
        items: [
          "Fixed 'Check for Updates' button not responding - now uses GitHub API",
          "Theme switching now works with CSS variables instead of hardcoded colors",
          "System theme changes update in real-time",
        ],
      },
    ],
  },
  {
    version: "0.1.4",
    date: "2026-06-21",
    sections: [
      {
        title: "Features",
        items: [
          "SDK-based package installation - install/remove pi packages without the CLI",
          "System tab with dependency checker (Node.js, npm, Git, Pi CLI status)",
          "Copyable quick-start install commands for pi CLI in System tab",
          "Links to pi.dev, documentation, quickstart guide, and models docs",
          "Warning banner when Node.js is missing",
        ],
      },
      {
        title: "Fixes",
        items: [
          "Package install/remove now uses DefaultPackageManager directly instead of spawning pi CLI",
          "Improved error messages when dependencies are missing",
        ],
      },
    ],
  },
  {
    version: "0.1.3",
    date: "2026-06-21",
    sections: [
      {
        title: "Fixes",
        items: [
          "Removed blocking onboarding that required Node.js/npm - app runs SDK in-process",
          "Pi CLI is now optional (installable from System tab)",
          "Simplified startup screen",
        ],
      },
    ],
  },
  {
    version: "0.1.2",
    date: "2026-06-21",
    sections: [
      {
        title: "Features",
        items: [
          "Custom model management with inline form and quick presets (Claude, OpenAI, Z.ai, MiniMax, MiMo, Grok)",
          "System tab with pi CLI installer and models.json location",
          "Auto-update banner toast with restart button",
          "GitHub Actions CI for auto-build on tag push",
          "One-click terminal install command in README",
        ],
      },
      {
        title: "Fixes",
        items: [
          "Fixed 'DMG is damaged' error - ad-hoc code signing via afterSign hook",
          "Fixed setModel returning { success } instead of full state",
          "Fixed model operations not passing tabId",
          "Updated publish config to correct GitHub repo",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-21",
    sections: [
      {
        title: "Features",
        items: [
          "Multi-tab parallel sessions with independent pi runtimes",
          "Streaming chat with markdown rendering, syntax highlighting, and collapsible tool output",
          "Slash command autocomplete with arrow-key navigation for commands, skills, and prompt templates",
          "Pi package explorer: browse, install, and remove packages from npm registry",
          "GitHub integration: PAT auth, create/attach repos, push/pull, per-folder linkage",
          "Session management: resume, fork, clone, favorites, organized by folder",
          "Model picker with provider grouping and thinking level control",
          "Token usage and session cost display in the status bar",
          "Extensions and Skills browser with tabs for extensions, skills, commands, and tools",
          "Native macOS menu bar tray icon with quick actions",
          "Drag-to-install DMG with custom Pi app icon",
          "Smart scroll tracking that stays pinned or lets you scroll freely",
          "PATH repair for GUI launches (Homebrew, nvm, Volta, fnm auto-detection)",
          "SharedDepsCache: cached AuthStorage/ModelRegistry/SettingsManager for fast tab creation",
          "MessageCache: instant session switching with in-memory message caching",
        ],
      },
      {
        title: "Keyboard Shortcuts",
        items: [
          "Cmd+M: switch models",
          "Cmd+N: new session",
          "Cmd+L: focus prompt",
          "Cmd+W: close tab (or window if last tab)",
          "Cmd+Shift+Enter: follow-up message during streaming",
          "Enter: send (or select slash command when dropdown is open)",
          "Shift+Enter: newline",
          "Arrow keys + Enter: slash command autocomplete navigation",
        ],
      },
    ],
  },
];

export function DesktopChangelog() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Pi Desktop</h2>
          <p className="text-xs text-text-faint">What's new in the desktop app.</p>
        </div>
        <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent">
          v{CHANGELOG[0].version}
        </span>
      </div>

      {CHANGELOG.map((entry) => (
        <div key={entry.version} className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
              {entry.version}
            </span>
            <span className="text-xs text-text-faint">{entry.date}</span>
          </div>
          <div className="space-y-3">
            {entry.sections.map((section, i) => (
              <div key={i}>
                <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-faint">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-2 text-xs text-text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
