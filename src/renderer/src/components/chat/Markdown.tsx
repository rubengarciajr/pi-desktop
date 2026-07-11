import { lazy, memo, Suspense, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { looksLikePath } from "../../../../shared/filePath";
import { FilePath } from "./FilePath";

const SyntaxCodeBlock = lazy(() => import("./SyntaxCodeBlock"));

interface MarkdownProps {
  children: string;
  streaming?: boolean;
}

/**
 * Memoized on {language, value}. The biggest single streaming win: previously
 * every prose token re-rendered the whole Markdown, which re-mounted every
 * CodeBlock and re-ran Prism highlighting over code whose content never
 * changed. Now unchanged code blocks skip Prism entirely.
 */
const CodeBlock = memo(function CodeBlock({
  language,
  value,
}: {
  language: string;
  value: string;
}) {
  const lineCount = value.split("\n").length;
  return (
    <div className="group relative my-2.5 max-w-full overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border bg-bg-subtle px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-faint">
          {language || "text"}
          {lineCount > 1 && (
            <span className="ml-2 normal-case text-text-faint/70">{lineCount} lines</span>
          )}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-[10px] text-text-faint opacity-0 transition-opacity hover:text-text-muted group-hover:opacity-100"
        >
          Copy
        </button>
      </div>
      {/* Scroll long lines inside the block so they never widen the chat canvas. */}
      <div className="overflow-x-auto">
        <Suspense
          fallback={
            <pre className="m-0 whitespace-pre px-3.5 py-2.5 font-mono text-xs leading-6 text-text-muted">
              {value}
            </pre>
          }
        >
          <SyntaxCodeBlock language={language} value={value} />
        </Suspense>
      </div>
    </div>
  );
});

/**
 * Web/markdown images render collapsed to a small chip by default — raw,
 * full-resolution images from fetched pages would otherwise blow out the
 * canvas. The user clicks to reveal a size-constrained preview.
 */
function ImageChip({ src, alt }: { src?: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  const label = (alt && alt.trim()) || (src ? filenameFromSrc(src) : "image");

  if (open) {
    return (
      <span className="my-2 block">
        <img
          src={src}
          alt={alt}
          className="max-h-80 max-w-full rounded-lg border border-border object-contain"
        />
        <button
          onClick={() => setOpen(false)}
          className="mt-1 block text-[11px] text-text-faint hover:text-text-muted"
        >
          Hide image
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      title={src}
      className="my-1 inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-text-faint"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-text-faint">· show image</span>
    </button>
  );
}

function filenameFromSrc(src: string): string {
  try {
    const clean = src.split("?")[0].split("#")[0];
    const name = clean.split("/").filter(Boolean).pop();
    return name && name.length <= 40 ? name : "image";
  } catch {
    return "image";
  }
}

/**
 * Hoisted to module scope so ReactMarkdown gets stable prop references across
 * renders. Previously these were allocated inline on every render — fresh array
 * + ~30-entry object literal per token during streaming — which also forced
 * react-markdown to invalidate its internal caches on reference change.
 */
const REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS: Components = {
  // Tight, chat-appropriate heading scale: distinguish by weight + small size
  // steps, not dramatic jumps. Body is 13px (text-[13px] on the wrapper), so
  // headings stay within 1-3px of it for visual cohesion.
  h1: ({ node, ...props }) => (
    <h1 className="mb-2 mt-3 text-[15px] font-semibold text-text" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mb-2 mt-3 text-[14px] font-semibold text-text" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mb-1.5 mt-2.5 text-[13px] font-semibold text-text" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="mb-1.5 mt-2.5 text-[13px] font-semibold text-text-muted" {...props} />
  ),
  h5: ({ node, ...props }) => (
    <h5 className="mb-1 mt-2 text-[13px] font-medium text-text-muted" {...props} />
  ),
  h6: ({ node, ...props }) => (
    <h6 className="mb-1 mt-2 text-[13px] font-medium text-text-faint" {...props} />
  ),
  p: ({ node, ...props }) => <p className="mb-2.5 leading-relaxed last:mb-0" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  ul: ({ node, ...props }) => <ul className="mb-2.5 ml-4 list-disc space-y-0.5" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-2.5 ml-4 list-decimal space-y-0.5" {...props} />,
  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-2.5 border-l-2 border-border-strong pl-3 text-text-muted italic"
      {...props}
    />
  ),
  hr: ({ node, ...props }) => <hr className="my-3 border-border" {...props} />,
  // Bold keeps the inherited color — don't force text-text (the brightest
  // shade), which made bolded words look like a different element.
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  del: ({ node, ...props }) => <del className="text-text-muted line-through" {...props} />,
  table: ({ node, ...props }) => (
    <div className="my-2.5 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="border-b border-border" {...props} />,
  th: ({ node, ...props }) => (
    <th className="px-2.5 py-1 text-left font-medium text-text" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border-t border-border px-2.5 py-1 text-text-muted" {...props} />
  ),
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-([^\s]+)/.exec(className || "");
    const value = String(children).replace(/\n$/, "");
    if (!inline && (match || value.includes("\n"))) {
      return <CodeBlock language={match?.[1] ?? ""} value={value} />;
    }
    // Inline code that is a file path becomes an interactive chip (reveal in
    // Finder / copy path). Non-path inline code renders as a plain accent chip.
    if (looksLikePath(value)) {
      return <FilePath path={value} variant="chip" />;
    }
    return (
      <code
        className="rounded bg-bg-hover px-1 py-0.5 text-[12px] font-mono text-accent break-words"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  img: ({ node, ...props }: any) => <ImageChip src={props.src} alt={props.alt} />,
  input: ({ node, ...props }) => (
    <input
      type="checkbox"
      className="mr-2 h-3 w-3 rounded border-border accent-accent"
      {...props}
    />
  ),
};

export const Markdown = memo(function Markdown({ children, streaming }: MarkdownProps) {
  return (
    <div
      className={`selectable min-w-0 max-w-full break-words text-[13px] leading-relaxed text-assistant ${streaming ? "streaming-cursor" : ""}`}
    >
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
