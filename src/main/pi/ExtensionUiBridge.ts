/**
 * ExtensionUiBridge — adapts Pi's extension UI protocol to our GUI.
 *
 * Pi extensions (plan-mode, subagents, …) drive the host UI through
 * `ctx.ui.*`: fire-and-forget calls (setStatus / setWidget / notify / setTitle)
 * and blocking dialogs (select / confirm / input / editor). In the terminal the
 * TUI renders these; in RPC mode they're serialized to a stdout protocol.
 *
 * This builds the same `ExtensionUIContext` shape used by the SDK's RPC mode
 * (see node_modules/@earendil-works/pi-coding-agent/dist/modes/rpc/rpc-mode.js)
 * but routes everything to the renderer over IPC instead of stdout. Wired into a
 * session via `session.extensionRunner.setUIContext(bridge, "rpc")`.
 */

/** Fire-and-forget UI update pushed to the renderer. */
export type ExtUiMessage =
  | { kind: "setStatus"; key: string; text?: string }
  | { kind: "setWidget"; key: string; lines?: string[]; placement?: string }
  | { kind: "notify"; message: string; level?: "info" | "warning" | "error" }
  | { kind: "setTitle"; title: string }
  | { kind: "reset" }
  | { kind: "request"; request: ExtUiDialogRequest };

/** A blocking dialog the renderer must answer. */
export interface ExtUiDialogRequest {
  id: string;
  method: "select" | "confirm" | "input" | "editor";
  title: string;
  message?: string;
  placeholder?: string;
  prefill?: string;
  options?: string[];
}

/** Response shape mirrors the SDK's RPC extension_ui_response. */
export type ExtUiDialogResponse =
  | { value: string }
  | { confirmed: boolean }
  | { cancelled: true };

export interface ExtensionUiBridgeHooks {
  /** Push a fire-and-forget UI update toward the renderer. */
  emit: (message: ExtUiMessage) => void;
  /** Register a blocking dialog; resolves when the renderer responds. */
  registerDialog: <T>(
    request: Omit<ExtUiDialogRequest, "id">,
    map: (response: ExtUiDialogResponse) => T,
    fallback: T,
  ) => Promise<T>;
}

/**
 * A theme that degrades any styling call to plain text. Extensions like the
 * SDK plan-mode example call `ctx.ui.theme.fg("accent", text)` /
 * `theme.strikethrough(text)`; we render styling ourselves in the renderer, so
 * the bridge just returns the underlying string for any theme access.
 */
function createThemeShim(): any {
  const fn = (...args: any[]): string => {
    const strings = args.filter((a) => typeof a === "string");
    return strings.length > 0 ? String(strings[strings.length - 1]) : "";
  };
  const proxy: any = new Proxy(fn, {
    get: () => proxy,
    apply: (_t, _this, args) => fn(...args),
  });
  return proxy;
}

/**
 * Build the ExtensionUIContext-shaped object handed to Pi's extension runner.
 * Typed loosely on purpose — the runner is accessed via `as any` and the SDK's
 * interface is large and mostly TUI-only.
 */
export function createExtensionUiBridge(hooks: ExtensionUiBridgeHooks): any {
  const theme = createThemeShim();

  return {
    // --- Blocking dialogs -------------------------------------------------
    select: (title: string, options: string[]) =>
      hooks.registerDialog(
        { method: "select", title, options },
        (r) => ("cancelled" in r ? undefined : "value" in r ? r.value : undefined),
        undefined,
      ),
    confirm: (title: string, message: string) =>
      hooks.registerDialog(
        { method: "confirm", title, message },
        (r) => ("cancelled" in r ? false : "confirmed" in r ? r.confirmed : false),
        false,
      ),
    input: (title: string, placeholder?: string) =>
      hooks.registerDialog(
        { method: "input", title, placeholder },
        (r) => ("cancelled" in r ? undefined : "value" in r ? r.value : undefined),
        undefined,
      ),
    editor: (title: string, prefill?: string) =>
      hooks.registerDialog(
        { method: "editor", title, prefill },
        (r) => ("cancelled" in r ? undefined : "value" in r ? r.value : undefined),
        undefined,
      ),

    // --- Fire-and-forget --------------------------------------------------
    notify: (message: string, level?: "info" | "warning" | "error") =>
      hooks.emit({ kind: "notify", message, level }),
    setStatus: (key: string, text: string | undefined) =>
      hooks.emit({ kind: "setStatus", key, text }),
    setWidget: (key: string, content: string[] | undefined, options?: { placement?: string }) => {
      // Only string-array widgets cross the bridge; TUI component factories are ignored.
      if (content === undefined || Array.isArray(content)) {
        hooks.emit({ kind: "setWidget", key, lines: content, placement: options?.placement });
      }
    },
    setTitle: (title: string) => hooks.emit({ kind: "setTitle", title }),

    // --- TUI-only: safe no-ops (match RPC mode) ---------------------------
    onTerminalInput: () => () => {},
    setWorkingMessage: () => {},
    setWorkingVisible: () => {},
    setWorkingIndicator: () => {},
    setHiddenThinkingLabel: () => {},
    setFooter: () => {},
    setHeader: () => {},
    custom: async () => undefined,
    pasteToEditor: () => {},
    setEditorText: () => {},
    getEditorText: () => "",
    addAutocompleteProvider: () => {},
    setEditorComponent: () => {},
    getEditorComponent: () => undefined,
    getToolsExpanded: () => false,
    setToolsExpanded: () => {},

    // --- Theme ------------------------------------------------------------
    get theme() {
      return theme;
    },
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: "Theme switching handled by the host app" }),
  };
}
