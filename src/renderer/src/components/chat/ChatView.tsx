import { useState, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useAppStore } from "../../store/useAppStore";
import { MessageItem } from "./MessageItem";
import { PromptInput } from "./PromptInput";
import { QueueChips } from "./QueueChips";
import { ExtensionWidgets } from "../extensions/ExtensionUi";
import { PiLogoIcon, FolderIcon } from "../Icons";

export function ChatView() {
  // Select only the fields this component uses, so unrelated tab state changes
  // (tool/queue/ext updates) don't re-render the whole message list. The
  // previous `s.activeTab` subscription re-rendered on every streaming token
  // AND every tool-call update.
  const messages = useAppStore((s) => s.activeTab.messages);
  const isStreaming = useAppStore((s) => s.activeTab.piState.isStreaming);
  const cwd = useAppStore((s) => s.activeTab.piState.cwd);
  const activeTabId = useAppStore((s) => s.activeTab.id);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  // Whether the viewport is pinned to the bottom (auto-following streaming
  // output). Virtuoso flips this via atBottomStateChange; followOutput reads it
  // so a token arriving while the user scrolled up never yanks the view back.
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // followOutput is invoked on every change that could add content. Return
  // "smooth" while pinned to follow streaming output; false once the user has
  // scrolled up so a token arriving mid-scroll-up never yanks the view back.
  const followOutput = () => {
    if (!atBottomRef.current) return false;
    return "smooth" as const;
  };

  const handleAtBottomChange = (atBottom: boolean) => {
    atBottomRef.current = atBottom;
    setShowJump(!atBottom);
  };

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      behavior: "smooth",
    });
  };

  // Reset follow state on tab switch so a fresh tab starts pinned at the bottom.
  // (Resetting the ref directly is enough; Virtuoso re-evaluates followOutput on
  // the next render.)
  const lastTabRef = useRef(activeTabId);
  if (lastTabRef.current !== activeTabId) {
    lastTabRef.current = activeTabId;
    atBottomRef.current = true;
    setShowJump(false);
  }

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
        {isEmpty ? (
          <EmptyState />
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            className="h-full"
            data={messages}
            followOutput={followOutput}
            atBottomStateChange={handleAtBottomChange}
            atBottomThreshold={80}
            computeItemKey={(_, msg) => msg.id}
            itemContent={(_, msg) => (
              // Horizontal padding lives on each item (the old layout used a
              // padded flex column); vertical spacing comes from the message's
              // own `py-2`.
              <div className="min-w-0 px-6">
                <MessageItem message={msg} />
              </div>
            )}
            components={{ Footer: () => <div className="h-6" /> }}
          />
        )}
        {isStreaming && atBottomRef.current && !isEmpty && (
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 py-1 text-xs text-thinking animate-pulse-subtle">
            Thinking...
          </div>
        )}
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
  const activeTabId = useAppStore((s) => s.activeTabId);

  const handleNewSession = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, cwd, mode: "code" });
    addTab({ id: tabId, title: cwd.split("/").pop() || cwd, cwd, mode: "code" });
    setActiveView("chat");
    window.dispatchEvent(new CustomEvent("pi:focusPrompt"));
  };

  const handleNewChat = async () => {
    // On launch, App.tsx already creates an empty Chat tab so the user lands
    // on a ready-to-type surface. Reuse it instead of opening a second tab —
    // the EmptyState only shows when messages.length === 0, so the active tab
    // is guaranteed empty here. Only create a fresh tab when there isn't one
    // to reuse (e.g. the user explicitly closed all tabs).
    if (activeTabId) {
      setActiveView("chat");
      window.dispatchEvent(new CustomEvent("pi:focusPrompt"));
      return;
    }
    const tabId = `tab-${Date.now()}`;
    await window.pi.api.createTab({ tabId, mode: "chat" });
    addTab({ id: tabId, title: "Chat", mode: "chat" });
    setActiveView("chat");
    window.dispatchEvent(new CustomEvent("pi:focusPrompt"));
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
      <h2
        onClick={chat ? handleNewChat : handleNewSession}
        className="cursor-pointer text-2xl font-semibold tracking-tight text-text-muted transition-colors hover:text-accent"
      >
        {chat ? "Start Chatting" : "Select Working Folder"}
      </h2>
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
