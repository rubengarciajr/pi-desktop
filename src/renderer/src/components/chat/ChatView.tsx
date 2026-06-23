import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { MessageItem } from "./MessageItem";
import { PromptInput } from "./PromptInput";
import { QueueChips } from "./QueueChips";
import { ExtensionWidgets } from "../extensions/ExtensionUi";
import { PiLogoIcon, FolderIcon } from "../Icons";

export function ChatView() {
  const activeTab = useAppStore((s) => s.activeTab);
  const messages = activeTab.messages;
  const isStreaming = activeTab.piState.isStreaming;
  const cwd = activeTab.piState.cwd;
  const scrollRef = useRef<HTMLDivElement>(null);
  // Pinned = follow new output. Toggled OFF the moment the user scrolls up, and
  // back ON only when they return to the bottom themselves. The auto-scroll's
  // own movement is distinguished from a user scroll by direction (it only ever
  // moves down to the bottom), so it can never re-pin against the user's wishes.
  const pinnedRef = useRef(true);
  const lastTopRef = useRef(0);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = true;
    el.scrollTop = el.scrollHeight;
    lastTopRef.current = el.scrollTop;
    setShowJump(false);
  };

  // Follow streaming output only while pinned. The pinned flag is re-checked at
  // rAF fire time, so a token that arrives mid-scroll-up never yanks the view.
  useEffect(() => {
    if (!pinnedRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      if (!pinnedRef.current || !el) return;
      el.scrollTop = el.scrollHeight;
      lastTopRef.current = el.scrollTop;
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const distance = el.scrollHeight - top - el.clientHeight;
    if (top < lastTopRef.current - 2) {
      pinnedRef.current = false; // user scrolled up — stop following
    } else if (distance < 24) {
      pinnedRef.current = true; // returned to the bottom — resume following
    }
    lastTopRef.current = top;
    setShowJump(!pinnedRef.current && distance > 80);
  };

  // Scroll to bottom on tab switch.
  useEffect(() => {
    pinnedRef.current = true;
    setShowJump(false);
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      lastTopRef.current = el.scrollTop;
    }
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
      <div className="relative flex-1 overflow-hidden">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto overflow-x-hidden">
          {isEmpty ? (
            <EmptyState />
          ) : (
            <div className="flex min-w-0 flex-col gap-1 px-6 pb-6">
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}
              {isStreaming && <div className="py-1 text-xs text-thinking animate-pulse-subtle">Thinking...</div>}
            </div>
          )}
        </div>
        {showJump && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-strong bg-bg-subtle px-3 py-1.5 text-xs text-text-muted shadow-lg backdrop-blur-xl transition-colors hover:bg-bg-hover hover:text-text animate-fade-in"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            {isStreaming ? "Jump to latest" : "Scroll to bottom"}
          </button>
        )}
      </div>

      <ExtensionWidgets />
      <QueueChips />
      <PromptInput />
    </div>
  );
}

function EmptyState() {
  const addTab = useAppStore((s) => s.addTab);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const defaultTabMode = useAppStore((s) => s.defaultTabMode);

  const handleNewSession = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, cwd, mode: "code" });
    addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd, mode: "code" });
    setActiveView("chat");
  };

  const handleNewChat = async () => {
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, mode: "chat" });
    addTab({ id: tabId, title: "Chat", mode: "chat" });
    setActiveView("chat");
  };

  const chat = defaultTabMode === "chat";

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <PiLogoIcon size={56} />
      <h1 className="mb-2 mt-4 text-xl font-semibold tracking-tight text-text">Pi Desktop</h1>
      <p className="mb-8 max-w-md text-sm text-text-muted">
        {chat
          ? "Start a quick chat — no folder needed. Convert it to a code session anytime with the ⚡ button."
          : "A full-featured desktop client for the Pi coding agent. Pick a working folder or drag one onto the tab bar to begin."}
      </p>
      <button
        onClick={chat ? handleNewChat : handleNewSession}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        {chat ? "Start Chatting" : "Select Working Folder"}
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
