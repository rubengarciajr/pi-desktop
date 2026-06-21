import { useEffect, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { MessageItem } from "./MessageItem";
import { PromptInput } from "./PromptInput";
import { QueueChips } from "./QueueChips";
import { PiLogoIcon, FolderIcon } from "../Icons";

export function ChatView() {
  const activeTab = useAppStore((s) => s.activeTab);
  const messages = activeTab.messages;
  const isStreaming = activeTab.piState.isStreaming;
  const cwd = activeTab.piState.cwd;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottom = useRef(true);

  // Auto-scroll to bottom only if user is already at/near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isPinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Track scroll position.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isPinnedToBottom.current = distanceFromBottom < 80;
  };

  // Scroll to bottom on tab switch.
  useEffect(() => {
    isPinnedToBottom.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeTab.id]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Working folder display */}
      {cwd && (
        <div className="flex items-center gap-2 px-6 py-2">
          <FolderIcon size={13} className="text-text-faint" />
          <span className="truncate text-xs font-mono text-text-faint">{cwd}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-1 px-6 pb-6">
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
            {isStreaming && <div className="py-1 text-xs text-thinking animate-pulse-subtle">Thinking...</div>}
          </div>
        )}
      </div>

      <QueueChips />
      <PromptInput />
    </div>
  );
}

function EmptyState() {
  const addTab = useAppStore((s) => s.addTab);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const handleNewSession = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, cwd });
    addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd });
    setActiveView("chat");
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <PiLogoIcon size={56} />
      <h1 className="mb-2 mt-4 text-xl font-semibold tracking-tight text-text">Pi Desktop</h1>
      <p className="mb-8 max-w-md text-sm text-text-muted">
        A full-featured desktop client for the Pi coding agent. Pick a working folder
        or drag one onto the tab bar to begin.
      </p>
      <button
        onClick={handleNewSession}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Select Working Folder
      </button>
      <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
        <Example text="Explain this codebase" />
        <Example text="Fix failing tests" />
        <Example text="Refactor the auth module" />
        <Example text="/help" mono />
      </div>
    </div>
  );
}

function Example({ text, mono }: { text: string; mono?: boolean }) {
  const send = async () => {
    const tabId = useAppStore.getState().activeTabId;
    await window.pi.api.prompt({ message: text, tabId: tabId ?? undefined });
  };
  return (
    <button
      onClick={send}
      className={`rounded-lg border border-border bg-bg-subtle px-4 py-3 text-left text-text-muted transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text ${mono ? "font-mono" : ""}`}
    >
      {text}
    </button>
  );
}
