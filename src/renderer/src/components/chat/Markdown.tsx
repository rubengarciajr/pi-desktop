import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownProps {
  children: string;
  streaming?: boolean;
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-bg">
      {language && (
        <div className="flex items-center justify-between border-b border-border bg-bg-subtle px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-faint">
            {language}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="text-[10px] text-text-faint opacity-0 transition-opacity hover:text-text-muted group-hover:opacity-100"
          >
            Copy
          </button>
        </div>
      )}
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "12px 16px",
          fontSize: "13px",
          fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
        }}
        codeTagProps={{ style: { fontFamily: "inherit" } }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

export const Markdown = memo(function Markdown({ children, streaming }: MarkdownProps) {
  return (
    <div
      className={`selectable text-sm leading-relaxed text-assistant ${streaming ? "streaming-cursor" : ""}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="mb-3 mt-4 text-lg font-semibold text-text" {...props} />,
          h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-base font-semibold text-text" {...props} />,
          h3: ({ node, ...props }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-text" {...props} />,
          h4: ({ node, ...props }) => <h4 className="mb-1 mt-3 text-sm font-semibold text-text" {...props} />,
          h5: ({ node, ...props }) => <h5 className="mb-1 mt-2 text-xs font-semibold text-text" {...props} />,
          h6: ({ node, ...props }) => <h6 className="mb-1 mt-2 text-xs font-medium text-text-muted" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 leading-relaxed last:mb-0" {...props} />,
          a: ({ node, ...props }) => (
            <a
              className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          ul: ({ node, ...props }) => <ul className="mb-3 ml-5 list-disc space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="mb-3 ml-5 list-decimal space-y-1" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-3 border-l-2 border-border-strong pl-4 text-text-muted italic"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => <hr className="my-4 border-border" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-text" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          del: ({ node, ...props }) => <del className="text-text-muted line-through" {...props} />,
          table: ({ node, ...props }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="border-b border-border" {...props} />,
          th: ({ node, ...props }) => (
            <th className="px-3 py-1.5 text-left font-medium text-text" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-t border-border px-3 py-1.5 text-text-muted" {...props} />
          ),
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");
            if (!inline && (match || value.includes("\n"))) {
              return <CodeBlock language={match?.[1] ?? ""} value={value} />;
            }
            return (
              <code
                className="rounded bg-bg-hover px-1.5 py-0.5 text-[13px] font-mono text-accent"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          input: ({ node, ...props }) => (
            <input
              type="checkbox"
              className="mr-2 h-3 w-3 rounded border-border accent-accent"
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
