/** Shared IPC types used by main, preload, and renderer. */

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
  authed: boolean;
  type?: "apiKey" | "oauth";
}

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
  createTab: (args: { tabId: string; cwd?: string }) => Promise<{ tabId: string; success: boolean }>;
  setActiveTab: (args: { tabId: string }) => Promise<{ success: boolean }>;
  removeTab: (args: { tabId: string }) => Promise<{ success: boolean }>;

  // Prompting
  prompt: (args: { message: string; images?: PiImage[]; streamingBehavior?: "steer" | "followUp"; tabId?: string }) => Promise<{ success: boolean }>;
  steer: (args: { message: string; images?: PiImage[]; tabId?: string }) => Promise<{ success: boolean }>;
  followUp: (args: { message: string; images?: PiImage[]; tabId?: string }) => Promise<{ success: boolean }>;
  abort: (args?: { tabId?: string }) => Promise<{ success: boolean }>;

  // Session
  newSession: (args?: { parentSession?: string; name?: string; cwd?: string; tabId?: string }) => Promise<{ success: boolean; cancelled?: boolean }>;
  switchSession: (args: { sessionPath: string; cwd?: string; tabId?: string }) => Promise<{ success: boolean; cancelled?: boolean }>;
  fork: (args: { entryId: string; tabId?: string }) => Promise<{ success: boolean; text?: string; cancelled?: boolean }>;
  clone: (args?: { tabId?: string }) => Promise<{ success: boolean; cancelled?: boolean }>;
  listSessions: (args?: { tabId?: string }) => Promise<PiSessionSummary[]>;
  listAllSessions: (args?: { tabId?: string }) => Promise<PiSessionSummary[]>;
  getSessionTree: (args?: { tabId?: string }) => Promise<PiSessionTree>;
  getForkMessages: (args?: { tabId?: string }) => Promise<{ messages: { entryId: string; text: string }[] }>;
  renameSession: (args: { name: string; tabId?: string }) => Promise<{ success: boolean }>;
  exportHtml: (args?: { outputPath?: string; tabId?: string }) => Promise<{ path: string }>;
  getMessages: (args?: { tabId?: string }) => Promise<unknown>;
  getState: (args?: { tabId?: string }) => Promise<PiState>;
  getSessionStats: (args?: { tabId?: string }) => Promise<PiSessionStats>;

  // Model & thinking
  setModel: (args: { provider: string; modelId: string; tabId?: string }) => Promise<{ success: boolean }>;
  cycleModel: (args?: { tabId?: string }) => Promise<PiState>;
  setThinkingLevel: (args: { level: string; tabId?: string }) => Promise<{ success: boolean }>;
  cycleThinkingLevel: (args?: { tabId?: string }) => Promise<{ level: string }>;
  getAvailableModels: (args?: { tabId?: string }) => Promise<{ models: PiModelInfo[] }>;

  // Compaction
  compact: (args?: { customInstructions?: string; tabId?: string }) => Promise<{ success: boolean; summary?: string; tokensBefore?: number; estimatedTokensAfter?: number }>;
  abortCompaction: (args?: { tabId?: string }) => Promise<{ success: boolean }>;
  setAutoCompaction: (args: { enabled: boolean }) => Promise<{ success: boolean }>;

  // Auth
  getAuthStatus: () => Promise<PiAuthStatus[]>;
  setApiKey: (args: { provider: string; apiKey: string }) => Promise<{ success: boolean }>;
  login: (args: { provider: string }) => Promise<{ success: boolean }>;
  logout: (args: { provider: string }) => Promise<{ success: boolean }>;

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
  customModelsList: () => Promise<{ providers: Record<string, { baseUrl?: string; api?: string; models: any[] }> }>;
  customModelAdd: (args: { provider: string; baseUrl: string; api: string; apiKey: string; modelId: string; modelName?: string; reasoning?: boolean; contextWindow?: number }) => Promise<{ success: boolean; error?: string }>;
  customModelRemove: (args: { provider: string; modelId: string }) => Promise<{ success: boolean }>;
  modelsJsonPath: () => Promise<string>;
  openModelsJson: () => Promise<{ success: boolean }>;
  systemCheck: () => Promise<{ npm: boolean; node: boolean; git: boolean; pi: boolean }>;

  // Misc
  getCwd: (args?: { tabId?: string }) => Promise<string>;
  setCwd: (args: { cwd: string; tabId?: string }) => Promise<{ success: boolean }>;
  pickDirectory: () => Promise<string | null>;
  getGitInfo: (args?: { tabId?: string }) => Promise<GitRepoInfo>;

  // Install
  checkPiInstalled: () => Promise<{ installed: boolean; version: string | null }>;
  startPiInstall: () => Promise<{ success: boolean; error?: string }>;
}

/** GitHub API surface. */
export interface GitHubApi {
  getAuthStatus: (args?: any) => Promise<GitHubAuthState>;
  verifyToken: (args: { token: string }) => Promise<GitHubAuthState>;
  logout: () => Promise<{ success: boolean }>;
  getSyncState: (args?: { tabId?: string }) => Promise<GitHubSyncState>;
  push: (args?: { tabId?: string }) => Promise<{ success: boolean; error?: string }>;
  pull: (args?: { tabId?: string }) => Promise<{ success: boolean; error?: string }>;
  createRepo: (args: { name?: string; private?: boolean; description?: string; tabId?: string }) => Promise<{ success: boolean; repoUrl?: string; error?: string }>;
  listRepos: () => Promise<{ name: string; fullName: string; private: boolean; url: string }[]>;
  attachRepo: (args: { owner: string; name: string; remoteUrl: string; tabId?: string }) => Promise<{ success: boolean; error?: string }>;
  cloneRepo: (args: { remoteUrl: string; localPath: string }) => Promise<{ success: boolean; error?: string }>;
  getLinkage: (args?: { tabId?: string }) => Promise<{ repoOwner: string; repoName: string; remoteUrl: string; linkedAt: string } | null>;
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

/** Packages API surface. */
export interface PackagesApi {
  search: () => Promise<PackageInfo[]>;
  installed: () => Promise<InstalledPackage[]>;
  install: (args: { spec: string }) => Promise<{ success: boolean; error?: string }>;
  remove: (args: { spec: string }) => Promise<{ success: boolean; error?: string }>;
  removeSkill: (args: { path: string }) => Promise<{ success: boolean; error?: string }>;
  removeExtension: (args: { path: string }) => Promise<{ success: boolean; error?: string }>;
  restoreStock: () => Promise<{ success: boolean; removed: string[]; error?: string }>;
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
  onSessionReset: (listener: (data: { sessionId: string; sessionFile?: string }) => void) => () => void;
  onInstallProgress: (listener: (progress: any) => void) => () => void;
  onInstallDone: (listener: (result: any) => void) => () => void;
  onPackagesChanged: (listener: () => void) => () => void;
  onUpdate: (listener: (data: any) => void) => () => void;
  onThemeChanged: (listener: (data: any) => void) => () => void;
  restartForUpdate: () => void;
  checkForUpdates: () => Promise<{
    status: "up-to-date" | "available" | "error";
    version?: string;
    downloadUrl?: string;
    releaseUrl?: string;
    releaseNotes?: string;
    message?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean }>;
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
  events: PiEventApi;
  versions: { electron: string; chrome: string; node: string; pi: string };
}

declare global {
  interface Window {
    pi: PiDesktopGlobal;
  }
}
