/** Shared IPC types used by main, preload, and renderer. */

/** Desktop-only UI preferences persisted in userData/app-settings.json. */
export interface AppSettings {
  /** Horizontal padding around messages — the GUI analog of Pi's `outputPad`. */
  messageDensity: "compact" | "comfortable" | "spacious";
  /** External editor command for the prompt (e.g. "code --wait"). Empty = fall back to Pi settings / $VISUAL / $EDITOR. */
  externalEditor: string;
}

export interface GitRepoInfo {
  isRepo: boolean;
  remoteUrl?: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  ahead?: number;
  behind?: number;
  dirty?: boolean;
  stagedCount?: number;
  unstagedCount?: number;
  untrackedCount?: number;
  lastCommitMessage?: string;
  lastCommitHash?: string;
  lastCommitDate?: string;
  lastCommitAuthor?: string;
  totalCommits?: number;
}

export interface PiSessionSummary {
  id: string;
  file: string;
  name?: string;
  cwd?: string;
  timestamp?: number;
  messageCount?: number;
  firstMessage?: string;
  parentId?: string | null;
}

export interface PiSessionTree {
  id: string;
  parentId: string | null;
  label?: string;
  timestamp?: number;
  children: PiSessionTree[];
}

export interface PiState {
  isStreaming: boolean;
  isCompacting: boolean;
  modelId?: string;
  modelName?: string;
  provider?: string;
  thinkingLevel?: string;
  sessionFile?: string;
  sessionId?: string;
  sessionName?: string;
  messageCount?: number;
  pendingMessageCount?: number;
  steeringMode?: string;
  followUpMode?: string;
  autoCompactionEnabled?: boolean;
  contextTokens?: number | null;
  contextWindow?: number | null;
  totalTokens?: number | null;
  totalCost?: number | null;
  /** Cumulative reasoning/thinking tokens (Pi 0.80.3+). Subset of totalTokens' output. */
  reasoningTokens?: number | null;
}

export interface PiModelInfo {
  id: string;
  name: string;
  provider: string;
  api?: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
}

export interface PiQueueState {
  steering: string[];
  followUp: string[];
}

export interface PiSessionStats {
  sessionId?: string;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
    /** Reasoning/thinking tokens (Pi 0.80.3+). Subset of `output`, not in `total`. */
    reasoning?: number;
  };
  cost: number;
  contextUsage?: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  };
}

export interface PiAuthStatus {
  provider: string;
  /** Display name from the SDK (e.g. "Anthropic (Claude Pro/Max)"). */
  name?: string;
  authed: boolean;
  /** Whether this provider offers OAuth subscription login at all. */
  loginType?: "oauth" | "apiKey";
  /** How it's currently authenticated — oauth subscription vs api_key. */
  type?: "apiKey" | "oauth";
}

/** An OAuth login-flow event pushed from the main process to the renderer. */
export type AuthEvent =
  | { kind: "auth"; provider: string; url: string; instructions?: string }
  | { kind: "deviceCode"; provider: string; userCode: string; verificationUri: string }
  | { kind: "progress"; provider: string; message: string }
  | {
      kind: "prompt";
      provider: string;
      requestId: string;
      message: string;
      placeholder?: string;
      allowEmpty?: boolean;
    }
  | {
      kind: "select";
      provider: string;
      requestId: string;
      message: string;
      options: { id: string; label: string }[];
    }
  | {
      kind: "manualCode";
      provider: string;
      requestId: string;
      message: string;
      placeholder?: string;
    }
  | { kind: "done"; provider: string }
  | { kind: "error"; provider: string; message: string };

export interface PiCommandInfo {
  name: string;
  description?: string;
  argumentHint?: string;
  source: "extension" | "prompt" | "skill";
  location?: "user" | "project" | "path";
  path?: string;
}

/** Canonical IPC channel map. Keys are the request channel names. */
export interface PiApi {
  // Tab management
  createTab: (args: {
    tabId: string;
    cwd?: string;
    mode?: "chat" | "code";
  }) => Promise<{ tabId: string; success: boolean }>;
  setActiveTab: (args: { tabId: string }) => Promise<{ success: boolean }>;
  removeTab: (args: { tabId: string }) => Promise<{ success: boolean }>;
  convertToCode: (args: {
    tabId?: string;
    cwd: string;
  }) => Promise<{ success: boolean; mdPath?: string; cwd?: string; error?: string }>;

  // Prompting
  prompt: (args: {
    message: string;
    images?: PiImage[];
    streamingBehavior?: "steer" | "followUp";
    tabId?: string;
  }) => Promise<{ success: boolean }>;
  steer: (args: {
    message: string;
    images?: PiImage[];
    tabId?: string;
  }) => Promise<{ success: boolean }>;
  followUp: (args: {
    message: string;
    images?: PiImage[];
    tabId?: string;
  }) => Promise<{ success: boolean }>;
  abort: (args?: { tabId?: string }) => Promise<{ success: boolean }>;
  removeQueued: (args: {
    kind: "steering" | "followUp";
    index: number;
    tabId?: string;
  }) => Promise<{ success: boolean }>;
  setChatWeb: (args: {
    enabled: boolean;
    tabId?: string;
  }) => Promise<{ success: boolean; webEnabled?: boolean; available?: boolean }>;
  setChatTools: (args: {
    enabled: boolean;
    tabId?: string;
  }) => Promise<{ success: boolean; toolsEnabled?: boolean }>;
  setChatRouting: (args: {
    enabled: boolean;
    teamId?: string;
    tabId?: string;
  }) => Promise<{ success: boolean; routingEnabled?: boolean }>;
  getMoaConfig: () => Promise<MoaConfig>;
  setMoaConfig: (args: MoaConfig) => Promise<{ success: boolean; error?: string }>;
  moaTest: (args: {
    message: string;
    team: MoaTeam;
    mode?: "basic" | "advanced";
    tabId?: string;
  }) => Promise<MoaResult>;
  // Tag Team — sequential model relay
  setChatTagTeam: (args: {
    enabled: boolean;
    teamId?: string;
    tabId?: string;
  }) => Promise<{ success: boolean; tagTeamEnabled?: boolean }>;
  getTagTeamConfig: () => Promise<TagTeamConfig>;
  setTagTeamConfig: (args: TagTeamConfig) => Promise<{ success: boolean; error?: string }>;
  tagTeamTest: (args: {
    message: string;
    team: TagTeamTeam;
    tabId?: string;
  }) => Promise<TagTeamResult>;
  getWebSearchStatus: () => Promise<{
    exa: boolean;
    perplexity: boolean;
    gemini: boolean;
    allowBrowserCookies: boolean;
    curator: boolean;
    webAccessInstalled: boolean;
  }>;
  setWebSearchConfig: (args: {
    exaApiKey?: string;
    perplexityApiKey?: string;
    geminiApiKey?: string;
    allowBrowserCookies?: boolean;
    workflow?: "none" | "summary-review";
  }) => Promise<{ success: boolean }>;

  // Session
  newSession: (args?: {
    parentSession?: string;
    name?: string;
    cwd?: string;
    tabId?: string;
  }) => Promise<{ success: boolean; cancelled?: boolean }>;
  switchSession: (args: {
    sessionPath: string;
    cwd?: string;
    tabId?: string;
  }) => Promise<{ success: boolean; cancelled?: boolean }>;
  fork: (args: {
    entryId: string;
    tabId?: string;
  }) => Promise<{ success: boolean; text?: string; cancelled?: boolean }>;
  clone: (args?: { tabId?: string }) => Promise<{ success: boolean; cancelled?: boolean }>;
  listSessions: (args?: { tabId?: string }) => Promise<PiSessionSummary[]>;
  listAllSessions: (args?: { tabId?: string }) => Promise<PiSessionSummary[]>;
  getSessionTree: (args?: { tabId?: string }) => Promise<PiSessionTree>;
  getForkMessages: (args?: {
    tabId?: string;
  }) => Promise<{ messages: { entryId: string; text: string }[] }>;
  renameSession: (args: { name: string; tabId?: string }) => Promise<{ success: boolean }>;
  exportHtml: (args?: { outputPath?: string; tabId?: string }) => Promise<{ path: string }>;
  getMessages: (args?: { tabId?: string }) => Promise<unknown>;
  getState: (args?: { tabId?: string }) => Promise<PiState>;
  getSessionStats: (args?: { tabId?: string }) => Promise<PiSessionStats>;

  // Model & thinking
  setModel: (args: {
    provider: string;
    modelId: string;
    tabId?: string;
  }) => Promise<{ success: boolean }>;
  cycleModel: (args?: { tabId?: string }) => Promise<PiState>;
  setThinkingLevel: (args: { level: string; tabId?: string }) => Promise<{ success: boolean }>;
  cycleThinkingLevel: (args?: { tabId?: string }) => Promise<{ level: string }>;
  getAvailableModels: (args?: { tabId?: string }) => Promise<{ models: PiModelInfo[] }>;

  // Compaction
  compact: (args?: {
    customInstructions?: string;
    tabId?: string;
  }) => Promise<{
    success: boolean;
    summary?: string;
    tokensBefore?: number;
    estimatedTokensAfter?: number;
  }>;
  abortCompaction: (args?: { tabId?: string }) => Promise<{ success: boolean }>;
  setAutoCompaction: (args: {
    enabled: boolean;
    tabId?: string;
  }) => Promise<{ success: boolean; autoCompactionEnabled?: boolean }>;

  // Auth
  getAuthStatus: () => Promise<PiAuthStatus[]>;
  setApiKey: (args: { provider: string; apiKey: string }) => Promise<{ success: boolean }>;
  login: (args: { provider: string }) => Promise<{ success: boolean; error?: string }>;
  logout: (args: { provider: string }) => Promise<{ success: boolean }>;
  /** Reply to a blocking OAuth prompt (onPrompt/onSelect/onManualCodeInput). */
  respondAuth: (args: { requestId: string; value?: string }) => Promise<{ success: boolean }>;

  // Settings
  getSettings: () => Promise<unknown>;
  setSettings: (args: { settings: Record<string, unknown> }) => Promise<{ success: boolean }>;

  // Extensions / skills / themes / commands
  getCommands: () => Promise<{ commands: PiCommandInfo[] }>;
  getExtensions: () => Promise<{ path: string; error?: string }[]>;
  getSkills: () => Promise<{ name: string; description?: string; source?: string }[]>;
  getThemes: () => Promise<{ name: string }[]>;
  getTools: () => Promise<{ tools: { name: string; description?: string; source?: string }[] }>;
  // Custom models management
  customModelsList: () => Promise<{
    providers: Record<string, { baseUrl?: string; api?: string; models: any[] }>;
  }>;
  customModelAdd: (args: {
    provider: string;
    baseUrl: string;
    api: string;
    apiKey: string;
    modelId: string;
    modelName?: string;
    reasoning?: boolean;
    contextWindow?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  /** Edit an existing custom model. Renames are handled; a blank apiKey keeps the current one. */
  customModelEdit: (args: {
    originalProvider: string;
    originalModelId: string;
    provider: string;
    baseUrl: string;
    api: string;
    apiKey?: string;
    modelId: string;
    modelName?: string;
    reasoning?: boolean;
    contextWindow?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  customModelRemove: (args: { provider: string; modelId: string }) => Promise<{ success: boolean }>;
  modelsJsonPath: () => Promise<string>;
  openModelsJson: () => Promise<{ success: boolean }>;
  /** Probe an OpenAI-compatible endpoint (GET {baseUrl}/models) to confirm reachability. */
  testModelConnection: (args: { baseUrl: string; apiKey?: string; modelId?: string }) => Promise<{
    ok: boolean;
    status?: number;
    models?: string[];
    modelFound?: boolean;
    error?: string;
  }>;
  systemCheck: () => Promise<{ npm: boolean; node: boolean; git: boolean; pi: boolean }>;

  // Misc
  getCwd: (args?: { tabId?: string }) => Promise<string>;
  setCwd: (args: { cwd: string; tabId?: string }) => Promise<{ success: boolean }>;
  pickDirectory: () => Promise<string | null>;
  /** Open a folder (or file) in the OS file manager / default handler. */
  openPath: (args: { path: string }) => Promise<{ success: boolean; error?: string }>;
  /** Reveal a file/folder in Finder, selecting it in its parent folder. */
  revealPath: (args: { path: string }) => Promise<{ success: boolean; error?: string }>;
  /** Load favorites from userData/favorites.json (survives restarts/updates). */
  getFavorites: () => Promise<{ path: string; name: string }[]>;
  /** Persist favorites to userData/favorites.json. */
  setFavorites: (args: {
    favorites: { path: string; name: string }[];
  }) => Promise<{ success: boolean; error?: string }>;
  /** Load desktop UI preferences from userData/app-settings.json. */
  getAppSettings: () => Promise<AppSettings>;
  /** Persist a partial patch of desktop UI preferences; returns the merged result. */
  setAppSettings: (args: { patch: Partial<AppSettings> }) => Promise<AppSettings>;
  /** Open the prompt text in the user's external editor; returns the edited text. */
  openExternalEditor: (args: {
    text: string;
  }) => Promise<{ ok: boolean; text?: string; error?: string }>;
  getGitInfo: (args?: { tabId?: string }) => Promise<GitRepoInfo>;
  /** Resolved Pi SDK version (from the SDK's own VERSION export). */
  getSdkVersion: () => Promise<string>;

  // System checks
  checkPiInstalled: () => Promise<{ installed: boolean; version: string | null }>;

  // Extension UI dialog response (answers a select/confirm/input/editor request)
  respondExtUi: (args: {
    tabId?: string;
    id: string;
    response: unknown;
  }) => Promise<{ success: boolean }>;
}

/** GitHub API surface. */
export interface GitHubApi {
  getAuthStatus: (args?: any) => Promise<GitHubAuthState>;
  verifyToken: (args: { token: string }) => Promise<GitHubAuthState>;
  logout: () => Promise<{ success: boolean }>;
  getSyncState: (args?: { tabId?: string; fetch?: boolean }) => Promise<GitHubSyncState>;
  push: (args?: { tabId?: string }) => Promise<{ success: boolean; error?: string }>;
  pull: (args?: { tabId?: string }) => Promise<{ success: boolean; error?: string }>;
  createRepo: (args: {
    name?: string;
    private?: boolean;
    description?: string;
    tabId?: string;
  }) => Promise<{ success: boolean; repoUrl?: string; error?: string }>;
  listRepos: () => Promise<{ name: string; fullName: string; private: boolean; url: string }[]>;
  attachRepo: (args: {
    owner: string;
    name: string;
    remoteUrl: string;
    tabId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  cloneRepo: (args: {
    remoteUrl: string;
    localPath: string;
  }) => Promise<{ success: boolean; error?: string }>;
  getLinkage: (args?: {
    tabId?: string;
  }) => Promise<{
    repoOwner: string;
    repoName: string;
    remoteUrl: string;
    linkedAt: string;
  } | null>;
}

export interface GitHubAuthState {
  authenticated: boolean;
  username?: string;
  avatarUrl?: string;
  error?: string;
}

export interface GitHubSyncState {
  ahead: number;
  behind: number;
  hasRemote: boolean;
  repoName?: string;
  repoOwner?: string;
  branch?: string;
  lastSync?: number;
  dirty?: boolean;
  changedFiles?: number;
}

/** Package catalog types. */
export interface PackageInfo {
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  types: string[];
  npmUrl: string;
  repoUrl?: string;
  installSpec: string;
  publishedDate?: string;
}

export interface InstalledPackage {
  spec: string;
  name: string;
  source: string;
}

/** Declarative per-extension settings (the `pi.settings` convention). */
export interface PiSettingsField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "secret";
  default?: unknown;
  description?: string;
  options?: string[];
}
export interface PiSettingsSchema {
  key: string;
  docs?: string;
  fields: PiSettingsField[];
}
export interface ExtensionDetail {
  meta: {
    name: string;
    version?: string;
    description?: string;
    homepage?: string;
    repository?: string;
    source: string;
  };
  readme: string | null;
  schema: PiSettingsSchema | null;
  values: Record<string, unknown>;
}

/** Declarative addon contributions (Tier 2: panels + status items). */
export interface PanelActionDef {
  label: string;
  command?: string;
  prompt?: string;
  url?: string;
}
export type PanelSection =
  | { type: "markdown"; content: string }
  | { type: "fields"; key: string; fields: PiSettingsField[]; values?: Record<string, unknown> }
  | { type: "actions"; actions: PanelActionDef[] }
  | { type: "list"; title?: string; items: string[] };
export interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
  source: string;
  sections: PanelSection[];
}
export interface StatusItemContribution {
  id: string;
  label: string;
  icon?: string;
  panelId?: string;
  source: string;
}
/** Declarative tool-call result renderer (Tier 2b). Field/path values are
 *  dot-paths into the tool's result object (e.g. "details.results"). */
export type ToolResultTemplate =
  | { type: "list"; items: string; title?: string; subtitle?: string; body?: string }
  | { type: "table"; items: string; columns: { label: string; field: string }[] }
  | { type: "keyvalue"; fields: { label: string; path: string }[] }
  | { type: "markdown"; path?: string; template?: string };
export interface ToolRendererContribution {
  tool: string;
  source: string;
  result: ToolResultTemplate;
}
export interface AddonsApi {
  contributions: () => Promise<{
    panels: PanelContribution[];
    statusItems: StatusItemContribution[];
    toolRenderers: ToolRendererContribution[];
  }>;
}

/** A package with a newer version available (never installed). */
export interface PackageUpdateInfo {
  source: string;
  displayName: string;
  type: "npm" | "git";
}

// --- Pi Routing (Mixture of Agents) ---

export interface MoaMember {
  provider: string;
  modelId: string;
  role?: string;
}

export interface MoaTeam {
  id: string;
  name: string;
  members: MoaMember[];
  aggregatorModel: { provider: string; modelId: string };
}

export interface MoaAdvancedConfig {
  maxLayers: number;
  confidenceThreshold: number;
  showTeamResponses: boolean;
  allowManualRequery: boolean;
}

export interface MoaConfig {
  teams: MoaTeam[];
  defaultMode: "basic" | "advanced";
  advanced: MoaAdvancedConfig;
}

export interface MoaMemberResult {
  provider: string;
  modelId: string;
  modelName: string;
  role?: string;
  response?: string;
  error?: string;
  score?: number;
}

export interface MoaResult {
  briefing: string;
  teamResponses: MoaMemberResult[];
  layers: number;
  confidence: number | null;
  teamName: string;
}

export interface MoaProgressEvent {
  phase: "fanning-out" | "member-done" | "aggregating" | "scoring" | "re-querying" | "done" | "error";
  layer: number;
  member?: string;
  progress: number;
  message?: string;
}

// --- Tag Team (sequential model relay) ---

export interface TagTeamStage {
  provider: string;
  modelId: string;
  /** Role label: "Starter", "Builder", "Reviewer", "Finalizer". */
  role?: string;
  /** Prompt sent to the NEXT model after this stage finishes. Unused on the last stage. */
  handoffPrompt?: string;
}

export interface TagTeamTeam {
  id: string;
  name: string;
  /** Ordered stages: [0] = starter, [last] = finalizer. */
  stages: TagTeamStage[];
}

export interface TagTeamConfig {
  teams: TagTeamTeam[];
}

export interface TagTeamStageResult {
  modelName: string;
  role?: string;
  output?: string;
  error?: string;
}

export interface TagTeamResult {
  teamName: string;
  stages: TagTeamStageResult[];
}

export interface TagTeamHandoffEvent {
  type: "tagteam:handoff";
  fromTabId: string;
  toTabId: string;
  fromModel: string;
  toModel: string;
  teamName: string;
  fromStage: number;
  toStage: number;
}

/** Packages API surface. */
export interface PackagesApi {
  search: () => Promise<PackageInfo[]>;
  installed: () => Promise<InstalledPackage[]>;
  install: (args: { spec: string }) => Promise<{ success: boolean; error?: string }>;
  remove: (args: { spec: string }) => Promise<{ success: boolean; error?: string }>;
  /** Update a single configured package to its latest version (in-app `pi update`). */
  update: (args: { spec: string; tabId?: string }) => Promise<{ success: boolean; error?: string }>;
  /** Check configured packages for available updates (does not install). */
  checkUpdates: (args?: { tabId?: string }) => Promise<PackageUpdateInfo[]>;
  removeSkill: (args: { path: string }) => Promise<{ success: boolean; error?: string }>;
  removeExtension: (args: { path: string }) => Promise<{ success: boolean; error?: string }>;
  restoreStock: () => Promise<{ success: boolean; removed: string[]; error?: string }>;
  detail: (args: { source: string }) => Promise<ExtensionDetail>;
  setConfig: (args: {
    key: string;
    values: Record<string, unknown>;
  }) => Promise<{ success: boolean }>;
}

export interface PiImage {
  type: "image";
  data: string; // base64
  mimeType: string;
}

/** Renderer-facing event listeners. Each on* returns an unsubscribe function. */
export interface PiEventApi {
  onEvent: (listener: (event: PiAgentEvent) => void) => () => void;
  onState: (listener: (state: PiState) => void) => () => void;
  onQueue: (listener: (queue: PiQueueState) => void) => () => void;
  onDiagnostics: (listener: (msg: string) => void) => () => void;
  onMenu: (listener: (action: string) => void) => () => void;
  onSessionReset: (
    listener: (data: { sessionId: string; sessionFile?: string }) => void,
  ) => () => void;
  onPackagesChanged: (listener: () => void) => () => void;
  onUpdate: (listener: (data: any) => void) => () => void;
  onUpdateProgress: (listener: (data: { loaded: number; total: number }) => void) => () => void;
  onMoaProgress: (listener: (data: MoaProgressEvent) => void) => () => void;
  onThemeChanged: (listener: (data: any) => void) => () => void;
  onExtUi: (listener: (message: any) => void) => () => void;
  /** OAuth login-flow events (open browser, show device code, prompt for input). */
  onAuthEvent: (listener: (message: AuthEvent) => void) => () => void;
  restartForUpdate: () => void;
  checkForUpdates: () => Promise<{
    status: "up-to-date" | "available" | "error";
    version?: string;
    downloadUrl?: string;
    releaseUrl?: string;
    releaseNotes?: string;
    message?: string;
  }>;
  downloadUpdate: (args?: {
    url?: string;
  }) => Promise<{ success: boolean; error?: string; path?: string }>;
  getTheme: () => Promise<{ shouldUseDarkColors: boolean; themeSource: string }>;
  setTheme: (source: "system" | "light" | "dark") => Promise<{ success: boolean }>;
}

/** Subset of pi events we forward. Shape mirrors pi's AgentSessionEvent.
 * All events are tagged with tabId so the renderer routes to the correct tab. */
export interface PiAgentEvent {
  type: string;
  tabId?: string;
  [key: string]: any;
}

/** Combined surface exposed on window.pi. */
export interface PiDesktopGlobal {
  api: PiApi;
  github: GitHubApi;
  packages: PackagesApi;
  addons: AddonsApi;
  events: PiEventApi;
  versions: { app: string; electron: string; chrome: string; node: string; pi: string };
}

declare global {
  interface Window {
    pi: PiDesktopGlobal;
  }
}
