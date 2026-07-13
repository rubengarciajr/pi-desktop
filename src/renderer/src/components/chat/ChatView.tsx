import { useState, useRef, useEffect } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useAppStore } from "../../store/useAppStore";
import { MessageItem } from "./MessageItem";
import { PromptInput } from "./PromptInput";
import { QueueChips } from "./QueueChips";
import { ExtensionWidgets } from "../extensions/ExtensionUi";
import { PiLogoIcon, FolderIcon } from "../Icons";
import { PiRoutingIcon, TagTeamIcon } from "../Icons";
import { MoaReportCard } from "./MoaReportCard";

export function ChatView() {
  // Select only the fields this component uses, so unrelated tab state changes
  // (tool/queue/ext updates) don't re-render the whole message list. The
  // previous `s.activeTab` subscription re-rendered on every streaming token
  // AND every tool-call update.
  const messages = useAppStore((s) => s.activeTab.messages);
  const isStreaming = useAppStore((s) => s.activeTab.piState.isStreaming);
  const cwd = useAppStore((s) => s.activeTab.piState.cwd);
  const activeTabId = useAppStore((s) => s.activeTab.id);
  const moaActivity = useAppStore((s) => s.activeTab.moaActivity);
  const setTabMoaActivity = useAppStore((s) => s.setTabMoaActivity);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  // Whether the viewport is pinned to the bottom (auto-following streaming
  // output). Virtuoso flips this via atBottomStateChange; followOutput reads it
  // so a token arriving while the user scrolled up never yanks the view back.
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [tagTeamHandoff, setTagTeamHandoff] = useState<{
    tabId: string;
    fromModel: string;
    toModel: string;
    teamName: string;
  } | null>(null);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for MOA (Pi Routing) progress/result events + Tag Team handoff.
  // MOA events are routed into the global store (moaActivity) so StatusBar
  // and TabBar can also react — they read from the store, not local state.
  useEffect(() => {
    const off = window.pi.events.onExtUi((message: any) => {
      const eventTabId = message?.tabId as string | undefined;

      if (message?.type === "moa:progress") {
        if (!eventTabId) return;
        if (message.phase === "done" || message.phase === "error") {
          // Don't clear immediately — the moa:result event (next) carries the
          // full result. Clear only the progress phase; the result persists.
          useAppStore.getState().setTabMoaActivity(eventTabId, (prev) => ({
            phase: "done",
            message: prev?.message,
            membersDone: prev?.membersDone,
            membersTotal: prev?.membersTotal,
            result: prev?.result,
          }));
        } else {
          const done = message.phase === "member-done";
          const membersDone = done
            ? (useAppStore.getState().tabStates[eventTabId]?.moaActivity?.membersDone ?? 0) + 1
            : useAppStore.getState().tabStates[eventTabId]?.moaActivity?.membersDone;
          const membersTotal = useAppStore.getState().tabStates[eventTabId]?.moaActivity?.membersTotal;
          useAppStore.getState().setTabMoaActivity(eventTabId, {
            phase: message.phase,
            message: message.message,
            member: message.member,
            membersDone,
            membersTotal,
          });
        }
      } else if (message?.type === "moa:result") {
        if (!eventTabId) return;
        useAppStore.getState().setTabMoaActivity(eventTabId, {
          phase: "complete",
          result: {
            teamName: message.teamName,
            briefing: message.briefing,
            teamResponses: message.teamResponses,
            layers: message.layers,
            confidence: message.confidence,
          },
        });
      } else if (message?.type === "tagteam:handoff") {
        const handoffTabId = (message.toTabId ?? eventTabId) as string | undefined;
        if (!handoffTabId) return;
        setTagTeamHandoff({
          tabId: handoffTabId,
          fromModel: message.fromModel ?? "Model A",
          toModel: message.toModel ?? "Model B",
          teamName: message.teamName ?? "Tag Team",
        });
        if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = setTimeout(() => {
          handoffTimerRef.current = null;
          setTagTeamHandoff(null);
        }, 8000);
      }
    });
    return () => {
      off();
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    };
  }, []);

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
      {/* Working folder display — click to open the folder in Finder */}
      {cwd && (
        <button
          onClick={() => window.pi.api.openPath({ path: cwd })}
          title="Open folder in Finder"
          className="group flex items-center gap-2 px-6 py-2 text-left transition-colors hover:text-text"
        >
          <FolderIcon size={13} className="text-text-faint group-hover:text-text" />
          <span className="truncate text-xs font-mono text-text-faint group-hover:text-text group-hover:underline">
            {cwd}
          </span>
        </button>
      )}

      {/* MOA report card — shows after Pi Routing completes, before the main model responds */}
      {moaActivity?.result && moaActivity.phase === "complete" && (
        <div className="px-[var(--msg-pad-x)]">
          <MoaReportCard
            teamName={moaActivity.result.teamName}
            briefing={moaActivity.result.briefing}
            teamResponses={moaActivity.result.teamResponses}
            layers={moaActivity.result.layers}
            confidence={moaActivity.result.confidence}
          />
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <Virtuoso
            // Keyed by tab so switching to (or freshly loading) a session
            // remounts the list, which re-applies initialTopMostItemIndex and
            // opens at the most recent message instead of the oldest.
            key={activeTabId}
            ref={virtuosoRef}
            className="h-full"
            data={messages}
            // Open a loaded conversation scrolled to the bottom (newest), the
            // way a chat should — not at the top (oldest).
            initialTopMostItemIndex={Math.max(0, messages.length - 1)}
            followOutput={followOutput}
            atBottomStateChange={handleAtBottomChange}
            atBottomThreshold={80}
            computeItemKey={(_, msg) => msg.id}
            itemContent={(_, msg) => (
              // Horizontal padding lives on each item (the old layout used a
              // padded flex column); vertical spacing comes from the message's
              // own `py-2`. The padding is driven by --msg-pad-x so the message
              // density setting (Settings → Appearance) can tune it.
              <div className="min-w-0 px-[var(--msg-pad-x)]">
                <MessageItem message={msg} />
              </div>
            )}
            components={{ Footer: () => <div className="h-6" /> }}
          />
        )}
        {moaActivity && moaActivity.phase !== "complete" && moaActivity.phase !== "done" && (
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 py-1 text-xs text-accent animate-pulse-subtle">
            <PiRoutingIcon size={12} />
            {moaActivity.message ?? "Pi Routing…"}
          </div>
        )}
        {tagTeamHandoff?.tabId === activeTabId && (
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 py-1 text-xs text-accent animate-pulse-subtle">
            <TagTeamIcon size={12} />
            🏷 {tagTeamHandoff.fromModel} → {tagTeamHandoff.toModel} · new tab
          </div>
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
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
  const focusExistingTab = useAppStore((s) => s.focusExistingTab);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const defaultTabMode = useAppStore((s) => s.defaultTabMode);
  const activeTabId = useAppStore((s) => s.activeTabId);

  const handleNewSession = async () => {
    const cwd = await window.pi.api.pickDirectory();
    if (!cwd) return;
    // A folder can only be open in one tab — focus it if already open.
    if (focusExistingTab(cwd)) {
      window.dispatchEvent(new CustomEvent("pi:focusPrompt"));
      return;
    }
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
