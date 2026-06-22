import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useAppStore } from "../../store/useAppStore";
import { SendIcon, StopIcon } from "../Icons";
import { GitHubBadge } from "../GitHubBadge";

interface CommandItem {
  name: string;
  description?: string;
  argumentHint?: string;
  source: string;
  kind: "command" | "skill" | "prompt";
}

const TUI_ONLY_COMMANDS = new Set([
  "tree", "model", "scoped-models", "thinking", "session", "sessions", "new", "resume",
  "fork", "clone", "compact", "share", "export", "import", "config", "reload",
  "skills", "trust", "login", "logout", "update", "install", "remove",
  "list", "quit", "exit", "help", "clear", "theme", "editor", "tools",
  "settings", "hotkeys", "changelog", "copy", "name",
]);

export function PromptInput() {
  const [text, setText] = useState("");
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [dropdownDismissed, setDropdownDismissed] = useState(false);
  const isStreaming = useAppStore((s) => s.activeTab.piState.isStreaming);
  const queue = useAppStore((s) => s.activeTab.queue);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch commands when tab changes or session becomes ready.
  // Extensions load asynchronously during session init, so we retry with
  // backoff until commands appear.
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
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
            const kind = c.source === "skill" ? "skill" : c.source === "prompt" ? "prompt" : "command";
            items.push({ name: c.name, description: c.description, argumentHint: c.argumentHint, source: c.source ?? "extension", kind });
          }
          items.sort((a, b) => a.name.localeCompare(b.name));
          if (!cancelled) setCommands(items);
        } else {
          attempt++;
          setTimeout(tryFetch, delays[attempt]);
        }
      } catch {
        // Session not ready yet, retry
        attempt++;
        if (attempt < delays.length) {
          setTimeout(tryFetch, delays[attempt]);
        }
      }
    };

    setCommands([]);
    setDropdownDismissed(false);
    tryFetch();

    return () => { cancelled = true; };
  }, [activeTabId]);

  // Refresh commands when packages/extensions change.
  useEffect(() => {
    const off = window.pi.events.onPackagesChanged(() => {
      // Small delay to let the backend reload resources.
      setTimeout(() => window.pi.api.getCommands().then((res: any) => {
        const cmds = res.commands ?? [];
        const items: CommandItem[] = [];
        for (const c of cmds) {
          if (TUI_ONLY_COMMANDS.has(c.name)) continue;
          const kind = c.source === "skill" ? "skill" : c.source === "prompt" ? "prompt" : "command";
          items.push({ name: c.name, description: c.description, argumentHint: c.argumentHint, source: c.source ?? "extension", kind });
        }
        items.sort((a, b) => a.name.localeCompare(b.name));
        setCommands(items);
      }).catch(() => {}), 500);
    });
    return () => { off?.(); };
  }, []);

  // Auto-resize the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [text]);

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

  const filteredCommands = slashQuery !== null
    ? commands.filter((c) => c.name.toLowerCase().includes(slashQuery))
    : [];

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
    setText("");
    setDropdownDismissed(false);
    const tabId = useAppStore.getState().activeTabId ?? undefined;
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
          <div ref={dropdownRef} className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-bg-active shadow-2xl">
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
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                  cmd.kind === "skill" ? "bg-thinking/20 text-thinking"
                  : cmd.kind === "prompt" ? "bg-success/20 text-success"
                  : "bg-accent/20 text-accent"
                }`}>
                  {cmd.kind === "skill" ? "SKILL" : cmd.kind === "prompt" ? "PROMPT" : "CMD"}
                </span>
                <span className="shrink-0 text-sm font-mono text-text">
                  /{cmd.name}
                </span>
                {cmd.argumentHint && (
                  <span className="shrink-0 rounded bg-bg-hover px-1 py-0.5 text-[10px] text-text-faint">{cmd.argumentHint}</span>
                )}
                {cmd.description && (
                  <span className="truncate text-xs text-text-faint">{cmd.description}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border bg-bg-hover focus-within:border-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); setDropdownDismissed(false); }}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Queue a steering message... (Enter to steer, Cmd+Shift+Enter for follow-up)" : "Message Pi Desktop (Enter to send) or type / for commands"}
            rows={1}
            className="block w-full resize-none bg-transparent px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none selectable"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-1 text-[11px] text-text-faint">
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">⏎</kbd>
              send
              <span className="mx-1">·</span>
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">⇧⏎</kbd>
              newline
              <span className="mx-1">·</span>
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">/</kbd>
              commands
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <GitHubBadge />
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
                  onClick={() => window.pi.api.abort({ tabId: useAppStore.getState().activeTabId ?? undefined })}
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
