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

  readonly events = new EventEmitter();
  readonly AGENT_EVENT = "pi:event";
  readonly STATE_EVENT = "pi:state";
  readonly QUEUE_EVENT = "pi:queue";
  readonly DIAG_EVENT = "pi:diag";
  readonly SESSION_RESET_EVENT = "pi:sessionReset";

  /** Get the manager for a tab, or the active tab if no tabId given. */
  get(tabId?: string): PiSessionManager | null {
    const id = tabId ?? this.activeTabId ?? undefined;
    if (!id) return null;
    return this.pools.get(id) ?? null;
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
      await mgr.init();
    }
    return mgr;
  }

  /** Create a new manager for a tab with a specific cwd. */
  async createForTab(tabId: string, cwd?: string): Promise<PiSessionManager> {
    // Remove old manager if exists
    const old = this.pools.get(tabId);
    if (old) {
      old.dispose();
    }

    const mgr = new PiSessionManager();
    this.attachEvents(tabId, mgr);
    this.pools.set(tabId, mgr);
    await mgr.init(cwd);
    return mgr;
  }

  /** Wire a manager's events to the pool's emitter, tagging with tabId. */
  private attachEvents(tabId: string, mgr: PiSessionManager) {
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
  }

  dispose() {
    for (const [, mgr] of this.pools) {
      mgr.dispose();
    }
    this.pools.clear();
    this.events.removeAllListeners();
  }
}
