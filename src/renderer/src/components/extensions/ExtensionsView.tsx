import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { InstalledPackage } from "../../../../shared/ipc";
import { ExtensionDetail } from "./ExtensionDetail";

interface ExtensionInfo {
  path: string;
  error?: string;
}

interface SkillInfo {
  name: string;
  description?: string;
  source?: string;
  path?: string;
}

interface CommandInfo {
  name: string;
  description?: string;
  argumentHint?: string;
  source: "extension" | "prompt" | "skill";
  location?: string;
  path?: string;
}

export function ExtensionsView() {
  const [tab, setTab] = useState<"extensions" | "skills" | "commands" | "tools" | "connectors">("extensions");
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [tools, setTools] = useState<{ name: string; description?: string; source?: string }[]>([]);
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    try {
      const [ext, skl, cmd, tls, pkgs] = await Promise.all([
        window.pi.api.getExtensions().catch(() => []),
        window.pi.api.getSkills().catch(() => ({ skills: [] })),
        window.pi.api.getCommands().catch(() => ({ commands: [] })),
        window.pi.api.getTools().catch(() => ({ tools: [] })),
        window.pi.packages.installed().catch(() => []),
      ]);
      setExtensions(ext as ExtensionInfo[]);
      setSkills((skl as any).skills ?? []);
      setCommands((cmd as any).commands ?? []);
      setTools((tls as any).tools ?? []);
      setInstalledPackages(pkgs as InstalledPackage[]);
    } catch (err) {
      console.error("Failed to load extensions:", err);
    }
  };

  const handleRemovePackage = async (spec: string) => {
    try {
      await window.pi.packages.remove({ spec });
      refresh();
    } catch {}
  };

  const handleRemoveSkill = async (skill: SkillInfo) => {
    if (!skill.path) return;
    try {
      const result = await window.pi.packages.removeSkill({ path: skill.path });
      if (result?.success) refresh();
    } catch {}
  };

  if (selected) {
    return (
      <div className="flex h-full flex-col">
        <div className="drag-region h-14 shrink-0" />
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-1">
          <ExtensionDetail source={selected} onBack={() => { setSelected(null); refresh(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="drag-region h-14 shrink-0" />
      <div className="no-drag flex items-center justify-between px-6 pb-3">
        <h1 className="text-sm font-semibold">Extensions & Skills</h1>
        <button
          onClick={refresh}
          className="no-drag rounded-lg border border-border bg-bg-hover px-3 py-1 text-xs text-text-muted hover:bg-bg-active"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="no-drag flex gap-1 border-b border-border px-6">
        <TabButton active={tab === "extensions"} onClick={() => setTab("extensions")} count={extensions.length + installedPackages.length}>
          Extensions
        </TabButton>
        <TabButton active={tab === "skills"} onClick={() => setTab("skills")} count={skills.length}>
          Skills
        </TabButton>
        <TabButton active={tab === "commands"} onClick={() => setTab("commands")} count={commands.length}>
          Commands
        </TabButton>
        <TabButton active={tab === "tools"} onClick={() => setTab("tools")} count={tools.length}>
          Tools
        </TabButton>
        <TabButton active={tab === "connectors"} onClick={() => setTab("connectors")}>
          Connectors
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div>
          {tab === "extensions" && (
            <ExtensionsList
              extensions={extensions}
              installedPackages={installedPackages}
              onRemovePackage={handleRemovePackage}
              onSettings={setSelected}
            />
          )}
          {tab === "skills" && <SkillsList skills={skills} onRemove={handleRemoveSkill} />}
          {tab === "commands" && <CommandsList commands={commands} />}
          {tab === "tools" && <ToolsList tools={tools} />}
          {tab === "connectors" && <ConnectorsPanel />}
        </div>

        {/* Restore to Stock - always visible at bottom */}
        <RestoreToStock onDone={refresh} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, count, children }: { active: boolean; onClick: () => void; count?: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
        active ? "text-text" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-faint">{count}</span>
      )}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
    </button>
  );
}

function ExtensionsList({
  extensions,
  installedPackages,
  onRemovePackage,
  onSettings,
}: {
  extensions: ExtensionInfo[];
  installedPackages: InstalledPackage[];
  onRemovePackage: (spec: string) => void;
  onSettings: (source: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Installed packages */}
      {installedPackages.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Installed Packages</h3>
          <div className="space-y-2">
            {installedPackages.map((pkg, i) => (
              <div key={i} className="group flex items-center justify-between rounded-lg border border-border bg-bg-subtle px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text">{pkg.name}</div>
                  <div className="truncate text-xs text-text-faint font-mono">{pkg.spec}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => onSettings(pkg.spec)}
                    className="rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted opacity-0 transition-opacity hover:bg-bg-active hover:text-text group-hover:opacity-100"
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => onRemovePackage(pkg.spec)}
                    className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger opacity-0 transition-opacity hover:bg-danger/20 group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loaded extensions */}
      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wider text-text-faint">Loaded Extensions</h3>
        {extensions.length === 0 ? (
          <EmptyState
            title="No extensions loaded"
            description="Add TypeScript extensions to your pi config directory (configDir/agent/extensions/) to extend Pi with custom tools, commands, and events."
            link="https://pi.dev/docs/latest/extensions"
          />
        ) : (
          <div className="space-y-2">
            {extensions.map((ext, i) => (
              <div key={i} className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${ext.error ? "bg-danger" : "bg-success"}`} />
                  <span className="truncate text-sm font-medium text-text">{ext.path.split("/").pop()}</span>
                </div>
                <div className="mt-1 truncate text-xs text-text-faint font-mono">{ext.path}</div>
                {ext.error && <div className="mt-2 text-xs text-danger">{ext.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillsList({ skills, onRemove }: { skills: SkillInfo[]; onRemove: (skill: SkillInfo) => void }) {
  if (skills.length === 0) {
    return (
      <EmptyState
        title="No skills loaded"
        description="Add skill directories with SKILL.md to your pi config directory (configDir/agent/skills/) to give Pi reusable on-demand capabilities."
        link="https://pi.dev/docs/latest/skills"
      />
  );
  }
  return (
    <div className="space-y-2">
      {skills.map((skill, i) => {
        const isRemovable = !!skill.path;
        return (
          <div
            key={i}
            className="no-drag group flex w-full items-start justify-between rounded-lg border border-border bg-bg-subtle px-4 py-3 text-left transition-colors hover:bg-bg-hover"
          >
            <button
              onClick={() => {
                const tabId = useAppStore.getState().activeTabId;
                window.pi.api.prompt({ message: `/skill:${skill.name}`, tabId: tabId ?? undefined });
              }}
              className="min-w-0 flex-1 text-left"
            >
              <div className="text-sm font-medium text-text">{skill.name}</div>
              {skill.description && <div className="mt-0.5 text-xs text-text-muted">{skill.description}</div>}
              {skill.source && (
                <span className="mt-1 inline-block rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-faint">
                  {skill.source}
                </span>
              )}
            </button>
            {isRemovable && (
              <button
                onClick={() => onRemove(skill)}
                className="ml-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger opacity-0 transition-opacity hover:bg-danger/20 group-hover:opacity-100"
              >
                Remove
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// TUI-only commands that don't work in SDK/desktop mode.
const TUI_ONLY_COMMANDS = new Set([
  "tree", "model", "thinking", "session", "sessions", "new", "resume",
  "fork", "clone", "compact", "share", "export", "config", "reload",
  "skills", "trust", "login", "logout", "update", "install", "remove",
  "list", "quit", "exit", "help", "clear", "theme", "editor", "tools",
]);

function CommandsList({ commands }: { commands: CommandInfo[] }) {
  // Filter out TUI-only commands that don't work in desktop mode.
  const desktopCommands = commands.filter((cmd) => !TUI_ONLY_COMMANDS.has(cmd.name));

  if (desktopCommands.length === 0) {
    return (
      <EmptyState
        title="No desktop commands available"
        description="Extension commands and prompt templates will appear here. TUI-only commands are hidden."
        link="https://pi.dev/docs/latest/extensions"
      />
    );
  }
  const grouped = desktopCommands.reduce((acc, cmd) => {
    (acc[cmd.source] ??= []).push(cmd);
    return acc;
  }, {} as Record<string, CommandInfo[]>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([source, cmds]) => (
        <div key={source}>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-text-faint">{source}</h3>
          <div className="space-y-1">
            {cmds.map((cmd, i) => (
              <button
                key={i}
                onClick={() => {
                  const tabId = useAppStore.getState().activeTabId;
                  window.pi.api.prompt({ message: `/${cmd.name}`, tabId: tabId ?? undefined });
                }}
                className="no-drag flex w-full items-center justify-between rounded-lg border border-border bg-bg-subtle px-4 py-2 text-left transition-colors hover:bg-bg-hover"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-accent">/{cmd.name}</span>
                    {cmd.argumentHint && (
                      <span className="rounded bg-bg-hover px-1 py-0.5 text-[10px] text-text-faint">{cmd.argumentHint}</span>
                    )}
                    {cmd.description && <span className="text-xs text-text-muted">{cmd.description}</span>}
                  </div>
                  {cmd.location && (
                    <span className="text-xs text-text-faint">{cmd.location}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolsList({ tools }: { tools: { name: string; description?: string; source?: string }[] }) {
  if (tools.length === 0) {
    return (
      <EmptyState
        title="No tools loaded"
        description="Built-in and extension-registered tools will appear here once a session is active."
      />
    );
  }
  const grouped = tools.reduce((acc, t) => {
    const src = t.source ?? "built-in";
    (acc[src] ??= []).push(t);
    return acc;
  }, {} as Record<string, typeof tools>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([source, tls]) => (
        <div key={source}>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-text-faint">{source}</h3>
          <div className="space-y-1">
            {tls.map((t, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-bg-subtle px-4 py-2">
                <div>
                  <span className="text-sm font-mono text-accent">{t.name}</span>
                  {t.description && <span className="ml-3 text-xs text-text-muted">{t.description}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectorsPanel() {
  return (
    <div>
      <div className="mb-4 rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <h3 className="mb-1 text-sm font-medium text-text">Custom Models</h3>
        <p className="text-xs text-text-muted">
          Add custom model entries in <code className="rounded bg-bg px-1 font-mono text-text-faint">configDir/agent/models.json</code> to connect to any provider API.
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <h3 className="mb-1 text-sm font-medium text-text">Custom Tools</h3>
        <p className="text-xs text-text-muted">
          Register custom tools via TypeScript extensions using <code className="rounded bg-bg px-1 font-mono text-text-faint">pi.registerTool()</code> to give Pi access to external APIs and services.
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <h3 className="mb-1 text-sm font-medium text-text">Custom Providers</h3>
        <p className="text-xs text-text-muted">
          Implement custom API endpoints and OAuth flows via the custom provider interface.
        </p>
        <a
          href="https://pi.dev/docs/latest/custom-provider"
          className="mt-2 inline-block text-xs text-accent hover:underline"
        >
          Learn more →
        </a>
      </div>
    </div>
  );
}

function EmptyState({ title, description, link }: { title: string; description: string; link?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="mb-2 text-sm font-medium text-text">{title}</h3>
      <p className="max-w-md text-xs text-text-muted">{description}</p>
      {link && (
        <a href={link} className="mt-3 text-xs text-accent hover:underline">
          Documentation →
        </a>
      )}
    </div>
  );
}

function RestoreToStock({ onDone }: { onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<{ success: boolean; removed: string[]; error?: string } | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setResult(null);
    try {
      const res = await window.pi.packages.restoreStock();
      setResult(res);
      if (res?.success) {
        setConfirming(false);
        onDone();
      }
    } catch (err) {
      setResult({ success: false, removed: [], error: String(err) });
    }
    setRestoring(false);
  };

  return (
    <div className="mt-8 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-danger">Restore to Stock Pi</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            Removes all packages, extensions, skills, prompts, and themes. Reverts to the 7 built-in tools.
          </p>
        </div>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="no-drag shrink-0 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:bg-danger/20"
          >
            Restore to Stock
          </button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="no-drag rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {restoring ? "Restoring..." : "Confirm Nuke"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={restoring}
              className="no-drag rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {result && (
        <div className="mt-3 text-xs">
          {result.success ? (
            <div className="space-y-1">
              <p className="text-success">Successfully restored to stock.</p>
              {result.removed.length > 0 && (
                <ul className="text-text-faint">
                  {result.removed.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-danger">Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
