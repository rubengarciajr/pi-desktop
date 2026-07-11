import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useAppStore } from "../../store/useAppStore";
import { SendIcon, StopIcon } from "../Icons";
import { GitHubBadge } from "../GitHubBadge";
import { RoutingToggle } from "./RoutingToggle";
import { TagTeamToggle } from "./TagTeamToggle";

interface CommandItem {
  name: string;
  description?: string;
  argumentHint?: string;
  source: string;
  kind: "command" | "skill" | "prompt";
}

const TUI_ONLY_COMMANDS = new Set([
  "tree",
  "model",
  "scoped-models",
  "thinking",
  "session",
  "sessions",
  "new",
  "resume",
  "fork",
  "clone",
  "compact",
  "share",
  "export",
  "import",
  "config",
  "reload",
  "skills",
  "trust",
  "login",
  "logout",
  "update",
  "install",
  "remove",
  "list",
  "quit",
  "exit",
  "help",
  "clear",
  "theme",
  "editor",
  "tools",
  "settings",
  "hotkeys",
  "changelog",
  "copy",
  "name",
]);

export function PromptInput() {
  const [text, setText] = useState("");
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [dropdownDismissed, setDropdownDismissed] = useState(false);
  const [converting, setConverting] = useState(false);
  const [editingInEditor, setEditingInEditor] = useState(false);
  const isStreaming = useAppStore((s) => s.activeTab.piState.isStreaming);
  const queue = useAppStore((s) => s.activeTab.queue);
  const hasMessages = useAppStore((s) => s.activeTab.messages.length > 0);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const mode = useAppStore((s) => s.activeTab.mode);
  const webEnabled = useAppStore((s) => s.activeTab.piState.webEnabled);
  const toolsEnabled = useAppStore((s) => s.activeTab.piState.toolsEnabled);
  const routingEnabled = useAppStore((s) => s.activeTab.piState.routingEnabled);
  const tagTeamEnabled = useAppStore((s) => s.activeTab.piState.tagTeamEnabled);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Toggle web-search tools in a chat (live — no rebuild, keeps the conversation).
  const toggleWeb = () => {
    const tabId = useAppStore.getState().activeTabId;
    if (!tabId) return;
    const next = !webEnabled;
    useAppStore.getState().setTabPiState(tabId, { webEnabled: next });
    window.pi.api.setChatWeb({ tabId, enabled: next }).catch(() => {});
  };

  // Toggle native Pi tools (read/bash/edit/…) in a chat (live).
  const toggleTools = () => {
    const tabId = useAppStore.getState().activeTabId;
    if (!tabId) return;
    const next = !toolsEnabled;
    useAppStore.getState().setTabPiState(tabId, { toolsEnabled: next });
    window.pi.api.setChatTools({ tabId, enabled: next }).catch(() => {});
  };

  // Open the current draft in the user's external editor (Pi 0.80.3
  // `externalEditor`), then replace the prompt with whatever they saved.
  const openInExternalEditor = async () => {
    if (editingInEditor) return;
    setEditingInEditor(true);
    try {
      const res = await window.pi.api.openExternalEditor({ text });
      if (res.ok && typeof res.text === "string") {
        setText(res.text.replace(/\n$/, ""));
      } else if (res.error) {
        useAppStore.getState().addDiagnostic(res.error);
      }
    } catch (err) {
      useAppStore
        .getState()
        .addDiagnostic(
          `External editor failed: ${err instanceof Error ? err.message : String(err)}`,
        );
    } finally {
      setEditingInEditor(false);
      textareaRef.current?.focus();
    }
  };

  // Chat → code: pick a folder, archive the chat to docs/, rebind with tools.
  const handleConvertToCode = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    const tabId = useAppStore.getState().activeTabId ?? undefined;
    setConverting(true);
    try {
      const res: any = await window.pi.api.convertToCode({ tabId, cwd });
      if (res?.success && tabId) {
        useAppStore
          .getState()
          .updateTab(tabId, { mode: "code", cwd, title: cwd.split("/").pop() || cwd });
        if (res.mdPath)
          useAppStore
            .getState()
            .addDiagnostic(`Converted to code session — chat saved to ${res.mdPath}`);
      } else if (res?.error) {
        useAppStore.getState().addDiagnostic(`Convert failed: ${res.error}`);
      }
    } catch (e: any) {
      useAppStore.getState().addDiagnostic(`Convert failed: ${e?.message ?? String(e)}`);
    } finally {
      setConverting(false);
    }
  };

  // Fetch commands when tab changes or session becomes ready.
  // Extensions load asynchronously during session init, so we retry with
  // backoff until commands appear.
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const delays = [0, 1000, 2000, 4000];

    const tryFetch = async () => {
      if (cancelled) return;
      try {
        const res = await window.pi.api.getCommands();
        if (cancelled) return;
        const cmds = res.commands ?? [];
        if (cmds.length > 0 || attempt >= delays.length - 1) {
          const items: CommandItem[] = [];
          for (const c of cmds) {
            if (TUI_ONLY_COMMANDS.has(c.name)) continue;
            const kind =
              c.source === "skill" ? "skill" : c.source === "prompt" ? "prompt" : "command";
            items.push({
              name: c.name,
              description: c.description,
              argumentHint: c.argumentHint,
              source: c.source ?? "extension",
              kind,
            });
          }
          items.sort((a, b) => a.name.localeCompare(b.name));
          if (!cancelled) setCommands(items);
        } else {
          attempt++;
          timer = setTimeout(tryFetch, delays[attempt]);
        }
      } catch {
        // Session not ready yet, retry
        attempt++;
        if (attempt < delays.length) {
          timer = setTimeout(tryFetch, delays[attempt]);
        }
      }
    };

    setCommands([]);
    setDropdownDismissed(false);
    tryFetch();

    // Cancel both the in-flight flag and any pending retry timer so rapid tab
    // switches don't stack backoff chains or setState after unmount.
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeTabId]);

  // Refresh commands when packages/extensions change.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = window.pi.events.onPackagesChanged(() => {
      // Small delay to let the backend reload resources.
      timer = setTimeout(
        () =>
          window.pi.api
            .getCommands()
            .then((res: any) => {
              if (cancelled) return;
              const cmds = res.commands ?? [];
              const items: CommandItem[] = [];
              for (const c of cmds) {
                if (TUI_ONLY_COMMANDS.has(c.name)) continue;
                const kind =
                  c.source === "skill" ? "skill" : c.source === "prompt" ? "prompt" : "command";
                items.push({
                  name: c.name,
                  description: c.description,
                  argumentHint: c.argumentHint,
                  source: c.source ?? "extension",
                  kind,
                });
              }
              items.sort((a, b) => a.name.localeCompare(b.name));
              setCommands(items);
            })
            .catch(() => {}),
        500,
      );
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      off?.();
    };
  }, []);

  // Auto-resize the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [text]);

  // Focus the prompt when the Cmd+L shortcut fires or when a new chat/code
  // tab is created from the empty state (the "Start Chatting" heading).
  useEffect(() => {
    const onFocusRequest = () => {
      // Slight delay so the tab swap (and resulting textarea mount) completes
      // before we try to focus it.
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    window.addEventListener("pi:focusPrompt", onFocusRequest);
    return () => window.removeEventListener("pi:focusPrompt", onFocusRequest);
  }, []);

  // Derive slash state directly from text - no async state, no timing bugs.
  const slashQuery = (() => {
    if (!text.startsWith("/")) return null;
    const query = text.slice(1).split(/\s/)[0].toLowerCase();
    // Empty query (just "/") or a partial word after "/"
    if (query === "") return "";
    // If there's already a space after the command, the user has moved past selection
    if (text.slice(1).includes(" ")) return null;
    return query;
  })();

  const filteredCommands =
    slashQuery !== null ? commands.filter((c) => c.name.toLowerCase().includes(slashQuery)) : [];

  // Show dropdown: only when there's a slash query, filtered results exist,
  // and the user hasn't dismissed it (by selecting, pressing Escape, or clicking away).
  const slashOpen = !dropdownDismissed && slashQuery !== null && filteredCommands.length > 0;

  // Reset index when the filter changes, and scroll the active item into view.
  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery]);

  useEffect(() => {
    if (!slashOpen || !dropdownRef.current) return;
    const el = dropdownRef.current.querySelector(`[data-idx="${slashIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [slashIndex, slashOpen]);

  const handleSubmit = async (streamingBehavior?: "steer" | "followUp") => {
    const message = text.trim();
    if (!message) return;
    const tabId = useAppStore.getState().activeTabId ?? undefined;

    // Built-in commands that map to app actions (the terminal's slash commands).
    if (/^\/compact(\s|$)/i.test(message)) {
      setText("");
      setDropdownDismissed(false);
      const customInstructions = message.replace(/^\/compact\s*/i, "").trim() || undefined;
      window.pi.api
        .compact({ customInstructions, tabId })
        .then((res: any) => {
          const note = useAppStore.getState().addDiagnostic;
          if (res?.success) note("Context compacted.");
          else if (res?.error) note(res.error);
        })
        .catch(() => {});
      return;
    }

    setText("");
    setDropdownDismissed(false);
    try {
      if (isStreaming && !streamingBehavior) {
        await window.pi.api.prompt({ message, streamingBehavior: "steer", tabId });
      } else if (streamingBehavior) {
        if (streamingBehavior === "steer") {
          await window.pi.api.steer({ message, tabId });
        } else {
          await window.pi.api.followUp({ message, tabId });
        }
      } else {
        await window.pi.api.prompt({ message, tabId });
      }
    } catch (err) {
      console.error("Prompt failed:", err);
    }
  };

  const insertCommand = (cmd: CommandItem) => {
    setText(`/${cmd.name} `);
    setDropdownDismissed(true);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash menu is open - intercept navigation keys.
    if (slashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        insertCommand(filteredCommands[slashIndex] ?? filteredCommands[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDropdownDismissed(true);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Enter" && e.metaKey && e.shiftKey) {
      e.preventDefault();
      handleSubmit("followUp");
    }
  };

  const pending = queue.steering.length + queue.followUp.length;

  return (
    <div className="no-drag border-t border-border bg-bg-subtle/50 px-6 py-4 backdrop-blur-xl">
      <div className="relative">
        {/* Slash command dropdown */}
        {slashOpen && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-bg-active shadow-2xl"
          >
            <div className="border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-faint">
              Commands & Skills ({filteredCommands.length})
            </div>
            {filteredCommands.map((cmd, i) => (
              <div
                key={`${cmd.kind}:${cmd.name}`}
                data-idx={i}
                onClick={() => insertCommand(cmd)}
                onMouseEnter={() => setSlashIndex(i)}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors ${
                  i === slashIndex ? "bg-bg-hover" : ""
                }`}
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    cmd.kind === "skill"
                      ? "bg-thinking/20 text-thinking"
                      : cmd.kind === "prompt"
                        ? "bg-success/20 text-success"
                        : "bg-accent/20 text-accent"
                  }`}
                >
                  {cmd.kind === "skill" ? "SKILL" : cmd.kind === "prompt" ? "PROMPT" : "CMD"}
                </span>
                <span className="shrink-0 text-sm font-mono text-text">/{cmd.name}</span>
                {cmd.argumentHint && (
                  <span className="shrink-0 rounded bg-bg-hover px-1 py-0.5 text-[10px] text-text-faint">
                    {cmd.argumentHint}
                  </span>
                )}
                {cmd.description && (
                  <span className="truncate text-xs text-text-faint">{cmd.description}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={`rounded-xl border bg-bg-hover ${
            !hasMessages
              ? "border-transparent animate-glow-accent"
              : "border-border transition-colors focus-within:border-accent/50"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDropdownDismissed(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? "Queue a steering message... (Enter to steer, Cmd+Shift+Enter for follow-up)"
                : mode === "chat" &&
                    (webEnabled || toolsEnabled || routingEnabled || tagTeamEnabled)
                  ? `${[toolsEnabled && "🛠 Tools", webEnabled && "🔍 Web", routingEnabled && "🔀 Routing", tagTeamEnabled && "🏷 Tag Team"].filter(Boolean).join(" + ")} on — ask away`
                  : "Message Pi Desktop (Enter to send) or type / for commands"
            }
            rows={1}
            className="block w-full resize-none bg-transparent px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none selectable"
          />
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
            <div className="hidden items-center gap-1 text-[11px] text-text-faint lg:flex">
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">⏎</kbd>
              send
              <span className="mx-1">·</span>
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">⇧⏎</kbd>
              newline
              <span className="mx-1">·</span>
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">/</kbd>
              commands
            </div>
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              {mode !== "chat" && <GitHubBadge />}
              {mode === "chat" && (
                <button
                  onClick={toggleTools}
                  title={
                    toolsEnabled
                      ? "Tools ON — agent can read/write files & run commands"
                      : "Tools OFF — pure conversation"
                  }
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    toolsEnabled
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border bg-bg-subtle text-text-faint hover:text-text-muted"
                  }`}
                >
                  <WrenchIcon size={12} />
                  Tools
                </button>
              )}
              {mode === "chat" && (
                <button
                  onClick={toggleWeb}
                  title={
                    webEnabled
                      ? "Web search ON — agent can search the web (built-in, no extension needed)"
                      : "Web search OFF — click to enable built-in web search (DuckDuckGo, no key required)"
                  }
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    webEnabled
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border bg-bg-subtle text-text-faint hover:text-text-muted"
                  }`}
                >
                  <SearchIcon size={12} />
                  Web
                </button>
              )}
              {/* Routing (MOA) and Tag Team work in both chat and code sessions. */}
              <RoutingToggle />
              <TagTeamToggle />
              <button
                onClick={openInExternalEditor}
                disabled={editingInEditor}
                aria-label="Open in external editor"
                title="Open in external editor — edit this prompt in your configured editor (e.g. code --wait). Set it in Settings → Appearance."
                className="flex items-center justify-center rounded-lg border border-border bg-bg-subtle px-2 py-1.5 text-text-faint transition-colors hover:text-text-muted disabled:opacity-40"
              >
                <ExternalEditorIcon size={14} />
              </button>
              {mode === "chat" && !isStreaming && (
                <button
                  onClick={handleConvertToCode}
                  disabled={converting}
                  aria-label="Convert to Code"
                  title="Convert to Code — pick a folder; this chat is saved to docs/ and continues with full tools"
                  className="flex items-center justify-center rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
                >
                  <BoltIcon size={14} />
                </button>
              )}
              <button
                onClick={() => handleSubmit()}
                disabled={!text.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendIcon size={12} />
                {isStreaming ? (pending > 0 ? "Queue" : "Steer") : "Send"}
              </button>
              {isStreaming && (
                <button
                  onClick={() =>
                    window.pi.api.abort({ tabId: useAppStore.getState().activeTabId ?? undefined })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
                >
                  <StopIcon size={12} />
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoltIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" />
    </svg>
  );
}

function SearchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function WrenchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z" />
    </svg>
  );
}

function ExternalEditorIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
