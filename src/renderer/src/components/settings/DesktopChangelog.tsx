interface DesktopChangelogEntry {
  version: string;
  date: string;
  sections: { title: string; items: string[] }[];
}

const CHANGELOG: DesktopChangelogEntry[] = [
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
          v0.1.4
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
