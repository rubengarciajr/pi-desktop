/**
 * SessionPool — manages multiple independent PiSessionManager instances,
 * one per tab. Each tab gets its own runtime, session, cwd, model, and event stream.
 *
 * All events are tagged with tabId before being forwarded to the renderer.
 */
import { EventEmitter } from "node:events";
import { PiSessionManager } from "./PiSessionManager";

export class SessionPool {
  private pools = new Map<string, PiSessionManager>();
  private activeTabId: string | null = null;
  /** In-flight init promises, keyed by tabId, so concurrent callers share one init. */
  private initPromises = new Map<string, Promise<PiSessionManager>>();

  readonly events = new EventEmitter();
  readonly AGENT_EVENT = "pi:event";
  readonly STATE_EVENT = "pi:state";
  readonly QUEUE_EVENT = "pi:queue";
  readonly DIAG_EVENT = "pi:diag";
  readonly SESSION_RESET_EVENT = "pi:sessionReset";
  readonly EXT_UI_EVENT = "pi:extui";
  /** OAuth login flow events (shared, not per-tab). */
  readonly AUTH_EVENT = "pi:auth.event";

  constructor() {
    // The pool fans every per-tab manager's events through this single emitter,
    // plus the IPC layer adds its own forwarders. Raise the cap above the
    // default 10 so a genuine leak still surfaces, but routine wiring doesn't.
    this.events.setMaxListeners(50);
  }

  /** Get the manager for a tab, or the active tab if no tabId given. */
  get(tabId?: string): PiSessionManager | null {
    const id = tabId ?? this.activeTabId ?? undefined;
    if (!id) return null;
    return this.pools.get(id) ?? null;
  }

  /**
   * Refresh every live manager's model registry from models.json so custom
   * model changes (add/edit/remove) show up in all open tabs immediately.
   * Call after invalidateSharedDeps() so the shared cache rebuilds fresh.
   */
  async refreshAllModelRegistries(): Promise<void> {
    await Promise.all(
      [...this.pools.values()].map((mgr) => mgr.refreshModelRegistry().catch(() => {})),
    );
  }

  /** Get or create a manager for a tab. */
  async getOrCreate(tabId: string): Promise<PiSessionManager> {
    let mgr = this.pools.get(tabId);
    if (!mgr) {
      mgr = new PiSessionManager();
      this.attachEvents(tabId, mgr);
      this.pools.set(tabId, mgr);
    }
    if (!mgr.isReady) {
      // Share a single in-flight init across concurrent callers; a second
      // call must not trigger a second init() (which would orphan the first
      // runtime/session and double-subscribe events).
      let pending = this.initPromises.get(tabId);
      if (!pending) {
        const target = mgr;
        pending = target.init().then(() => target);
        this.initPromises.set(tabId, pending);
        pending.finally(() => {
          if (this.initPromises.get(tabId) === pending) this.initPromises.delete(tabId);
        });
      }
      return pending;
    }
    return mgr;
  }

  /** Create a new manager for a tab with a specific cwd. */
  async createForTab(
    tabId: string,
    cwd?: string,
    opts?: { chatMode?: boolean },
  ): Promise<PiSessionManager> {
    // Remove old manager if exists
    const old = this.pools.get(tabId);
    if (old) {
      old.dispose();
    }
    this.initPromises.delete(tabId);

    const mgr = new PiSessionManager();
    this.attachEvents(tabId, mgr);
    this.pools.set(tabId, mgr);
    await mgr.init(cwd, opts);
    return mgr;
  }

  /**
   * Create a new tab for a Tag Team handoff. Sets the next stage's model,
   * seeds the session with the previous model's output, injects the handoff
   * prompt, and auto-prompts. Returns the new tab's id.
   */
  async createHandoffTab(opts: {
    cwd?: string;
    provider: string;
    modelId: string;
    previousOutput: string;
    handoffPrompt: string;
  }): Promise<string> {
    const tabId = `tagteam-${Date.now()}`;
    const mgr = await this.createForTab(tabId, opts.cwd, { chatMode: true });

    // Set the next stage's model.
    try {
      await mgr.setModel(opts.provider, opts.modelId);
    } catch (err) {
      this.events.emit(this.DIAG_EVENT, `Tag Team: could not set model ${opts.provider}/${opts.modelId}: ${err}`);
    }

    // Seed the session with the previous model's output as a visible message
    // so the next model sees the work it's improving.
    const session = (mgr as any).session;
    const sm = session?.sessionManager;
    if (sm?.appendMessage) {
      try {
        await sm.appendMessage({
          role: "user",
          content: `[Tag Team handoff — previous model's output]\n\n${opts.previousOutput}`,
        });
      } catch (err) {
        console.error("[pi-desktop] Tag Team: failed to seed context:", err);
      }
    }

    // Auto-prompt with the handoff instructions. This runs asynchronously —
    // the renderer sees the new tab's streaming state via events.
    mgr.prompt(`[Tag Team — a previous model built the work above]\n\n${opts.handoffPrompt}`).catch((err) => {
      console.error("[pi-desktop] Tag Team handoff prompt failed:", err);
      this.events.emit(this.DIAG_EVENT, `Tag Team: next model failed to start: ${err}`);
    });

    return tabId;
  }

  /** Wire a manager's events to the pool's emitter, tagging with tabId. */
  private attachEvents(tabId: string, mgr: PiSessionManager) {
    // Idempotent: clear any prior wiring so re-attaching (e.g. createForTab on
    // an existing tabId) never stacks duplicate listeners on this manager.
    mgr.events.removeAllListeners();

    // Wire the Tag Team handoff callback so the manager can ask the pool to
    // create a new tab for the next stage.
    mgr.tagTeamHandoffCallback = async (opts) => {
      const newTabId = await this.createHandoffTab(opts);
      // Emit a handoff event with both tab ids so the renderer can switch tabs.
      this.events.emit(this.EXT_UI_EVENT, {
        type: "tagteam:handoff",
        fromTabId: tabId,
        toTabId: newTabId,
        fromModel: opts.fromModelName,
        toModel: opts.toModelName,
        teamName: opts.teamName,
        fromStage: opts.fromStage,
        toStage: opts.toStage,
      });
      return newTabId;
    };

    mgr.events.on(mgr.AGENT_EVENT, (event: any) => {
      this.events.emit(this.AGENT_EVENT, { ...event, tabId });
    });
    mgr.events.on(mgr.STATE_EVENT, (state: any) => {
      this.events.emit(this.STATE_EVENT, { ...state, tabId });
    });
    mgr.events.on(mgr.QUEUE_EVENT, (queue: any) => {
      this.events.emit(this.QUEUE_EVENT, { ...queue, tabId });
    });
    mgr.events.on(mgr.SESSION_RESET_EVENT, (data: any) => {
      this.events.emit(this.SESSION_RESET_EVENT, { ...data, tabId });
    });
    mgr.events.on(mgr.DIAG_EVENT, (msg: string) => {
      this.events.emit(this.DIAG_EVENT, msg);
    });
    mgr.events.on(mgr.EXT_UI_EVENT, (message: any) => {
      this.events.emit(this.EXT_UI_EVENT, { ...message, tabId });
    });
    // OAuth events are shared (auth.json is global), but we still tag with the
    // originating tabId so the renderer can route the modal if needed.
    mgr.events.on(mgr.AUTH_EVENT, (message: any) => {
      this.events.emit(this.AUTH_EVENT, { ...message, tabId });
    });
  }

  setActiveTab(tabId: string) {
    this.activeTabId = tabId;
  }

  getActiveTab(): string | null {
    return this.activeTabId;
  }

  removeTab(tabId: string) {
    const mgr = this.pools.get(tabId);
    if (mgr) {
      mgr.dispose();
      this.pools.delete(tabId);
    }
    this.initPromises.delete(tabId);
    // Don't leave activeTabId dangling at a removed tab — later getOrCreate
    // calls would silently resurrect a hidden manager for a gone tab.
    if (this.activeTabId === tabId) {
      this.activeTabId = this.pools.keys().next().value ?? null;
    }
  }

  dispose() {
    for (const [, mgr] of this.pools) {
      mgr.dispose();
    }
    this.pools.clear();
    this.events.removeAllListeners();
  }
}
