import { memo } from "react";
import type { ChatMessage } from "../../store/useAppStore";
import { ToolCallBlock } from "./ToolCallBlock";
import { DiffViewer } from "./DiffViewer";
import { Markdown } from "./Markdown";

// Memoized: the store hands out a new message object only when that specific
// message changes, so unchanged history is skipped on every streaming delta.
// Tool/diff subtrees subscribe to the store directly, so they still update.
export const MessageItem = memo(function MessageItem({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }
  return <AssistantMessage message={message} />;
});

function UserMessage({ message }: { message: ChatMessage }) {
  const text = message.blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return (
    <div className="group flex justify-end py-2 animate-slide-up">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-user/15 px-4 py-2.5 text-sm text-text selectable">
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="min-w-0 max-w-full break-words py-2 animate-fade-in">
      {message.blocks.map((block, i) => {
        if (block.type === "text") {
          return (
            <Markdown key={i} streaming={message.streaming}>
              {block.text ?? ""}
            </Markdown>
          );
        }
        if (block.type === "thinking") {
          return <ThinkingBlock key={i} text={block.text ?? ""} />;
        }
        if (block.type === "toolCall") {
          return <ToolCallBlock key={i} toolCallId={block.toolCallId ?? ""} />;
        }
        return null;
      })}
      {/* Render any diffs from edit tools */}
      <EditDiffs message={message} />
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="mb-2 rounded-lg border border-border bg-bg-subtle/40 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-thinking">
        Reasoning
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-text-muted whitespace-pre-wrap selectable">
        {text}
      </p>
    </details>
  );
}

function EditDiffs({ message }: { message: ChatMessage }) {
  const editTools = useEditToolResults(message);
  if (editTools.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {editTools.map((tool) => (
        <DiffViewer key={tool.toolCallId} toolCallId={tool.toolCallId} />
      ))}
    </div>
  );
}

// Small hook to find completed edit tools referenced by this message's tool calls.
import { useAppStore } from "../../store/useAppStore";
function useEditToolResults(message: ChatMessage) {
  const tools = useAppStore((s) => s.activeTab.tools);
  return message.blocks
    .filter((b) => b.type === "toolCall" && (b.toolName === "edit" || b.toolName === "write"))
    .map((b) => tools[b.toolCallId ?? ""])
    .filter((t): t is NonNullable<typeof t> => !!t && t.done && t.toolName === "edit");
}
