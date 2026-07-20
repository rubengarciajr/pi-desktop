import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

/**
 * OAuth subscription login modal. Renders at the app root when an auth flow is
 * active (`authFlow` in the store), adapting its contents to the current phase:
 *   - browser:    "browser opened" + manual-code-paste fallback
 *   - deviceCode: big user code + "open provider" button
 *   - prompt:     text input (e.g. manual auth code)
 *   - select:     option buttons (e.g. Codex browser vs device)
 *   - manualCode: text input
 *   - progress:   status line
 *   - error:      error message + dismiss
 *
 * Blocking phases (prompt/select/manualCode) carry a requestId; the user's reply
 * goes back via window.pi.api.respondAuth, which unblocks the SDK's login flow.
 */
export function AuthFlowModal() {
  const authFlow = useAppStore((s) => s.authFlow);
  const clearAuthFlow = useAppStore((s) => s.clearAuthFlow);
  const [inputValue, setInputValue] = useState("");

  if (!authFlow) return null;
  const { phase, provider, message, url, userCode, verificationUri, placeholder, options, requestId, error } = authFlow;
  const label = PROVIDER_LABELS[provider] ?? provider;

  const respond = (value?: string) => {
    if (requestId) {
      window.pi.api.respondAuth({ requestId, value }).catch(() => {});
    }
    setInputValue("");
    // Don't clearAuthFlow here for blocking prompts — the SDK may push another
    // phase (progress/done/error) next. Only clear on explicit cancel/error/done.
  };

  const cancel = () => {
    if (requestId) window.pi.api.respondAuth({ requestId, value: undefined }).catch(() => {});
    clearAuthFlow();
    setInputValue("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[420px] max-w-[90vw] rounded-xl border border-border bg-bg-active p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Connect {label}</h2>
          {phase !== "progress" && (
            <button
              onClick={cancel}
              className="flex h-6 w-6 items-center justify-center rounded text-text-faint hover:bg-bg-hover hover:text-text"
              title="Cancel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Browser PKCE phase */}
        {phase === "browser" && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              Your browser opened to {label}. Complete the sign-in there.
              If it didn't, open the link manually:
            </p>
            {url && (
              <button
                onClick={() => window.open(url, "_blank")}
                className="block w-full truncate rounded-lg border border-border bg-bg-hover px-3 py-2 text-left text-xs text-accent hover:bg-bg-active"
                title={url}
              >
                {url}
              </button>
            )}
            <p className="text-xs text-text-faint">
              If the page gives you a code, the dialog will ask for it next.
            </p>
          </div>
        )}

        {/* Device-code phase (Copilot, Codex device method) */}
        {phase === "deviceCode" && (
          <div className="space-y-3 text-center">
            <p className="text-xs text-text-muted">Enter this code on {label}:</p>
            {userCode && (
              <div className="selectable rounded-lg border border-border bg-bg px-4 py-3 text-2xl font-bold tracking-[0.3em] text-text">
                {userCode}
              </div>
            )}
            {verificationUri && (
              <button
                onClick={() => window.open(verificationUri, "_blank")}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Open {label}
              </button>
            )}
            <p className="text-xs text-text-faint">Waiting for you to approve…</p>
          </div>
        )}

        {/* Progress / waiting */}
        {phase === "progress" && (
          <div className="flex items-center gap-2 py-2 text-xs text-text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            {message ?? "Working…"}
          </div>
        )}

        {/* Text-input phases (prompt / manualCode) */}
        {(phase === "prompt" || phase === "manualCode") && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">{message}</p>
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) respond(inputValue.trim());
              }}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text focus:border-accent/50 focus:outline-none selectable"
            />
            <div className="flex justify-end gap-2">
              <button onClick={cancel} className="rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted hover:bg-bg-active">
                Cancel
              </button>
              <button
                onClick={() => respond(inputValue.trim())}
                disabled={!inputValue.trim()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Select phase (e.g. Codex browser vs device) */}
        {phase === "select" && (
          <div className="space-y-2">
            <p className="mb-2 text-xs text-text-muted">{message}</p>
            {(options ?? []).map((opt) => (
              <button
                key={opt.id}
                onClick={() => respond(opt.id)}
                className="w-full rounded-lg border border-border bg-bg-hover px-3 py-2 text-left text-xs text-text hover:border-accent/40 hover:bg-bg-active"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Error phase */}
        {phase === "error" && (
          <div className="space-y-3">
            <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              {error ?? "Login failed."}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  clearAuthFlow();
                  setInputValue("");
                }}
                className="rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted hover:bg-bg-active"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic Claude",
  "openai-codex": "ChatGPT",
  "github-copilot": "GitHub Copilot",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI (Grok)",
};
