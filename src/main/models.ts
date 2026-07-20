/**
 * Custom models manager - reads/writes ~/.pi/agent/models.json
 * so users can add models from the GUI without touching the terminal.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CONFIG_DIR = ".pi";

function getAgentDir(): string {
  return join(homedir(), CONFIG_DIR, "agent");
}

function getModelsJsonPath(): string {
  return join(getAgentDir(), "models.json");
}

interface CustomModel {
  id: string;
  name?: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
}

interface CustomProvider {
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  models: CustomModel[];
}

interface ModelsJson {
  providers: Record<string, CustomProvider>;
}

function readModelsJson(): ModelsJson {
  const path = getModelsJsonPath();
  if (!existsSync(path)) {
    return { providers: {} };
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      providers: parsed.providers ?? {},
    };
  } catch {
    return { providers: {} };
  }
}

function writeModelsJson(data: ModelsJson): void {
  const dir = getAgentDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getModelsJsonPath(), JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function listCustomModels(): { providers: Record<string, { baseUrl?: string; api?: string; models: CustomModel[] }> } {
  const data = readModelsJson();
  return { providers: data.providers };
}

/**
 * Slugify a user- or preset-supplied provider name into a models.json key.
 * Previously this was just lowercase + space→dash, so a prose label such as
 * "Grok (xAI)" became the key `grok-(xai)`: punctuation survived, and the same
 * provider added via preset vs. typed by hand produced two separate entries.
 * Keep only characters that read cleanly as an id, and collapse the runs the
 * stripping leaves behind.
 */
export function slugifyProvider(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

/** True for localhost / loopback base URLs (local model servers). */
function isLocalUrl(url: string): boolean {
  return /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:|\/|$)/i.test(url ?? "");
}

/**
 * Normalize the stored API key. Local servers ignore the key, but the SDK's
 * model registry HIDES providers whose key is empty or the unresolved
 * `$API_KEY` placeholder (it reads `$…` as an env var). For a localhost URL we
 * substitute a harmless literal so the provider's models actually show up in
 * the switcher; otherwise we leave the value as the caller supplied it.
 */
function normalizeApiKey(apiKey: string | undefined, baseUrl: string): string {
  const key = apiKey?.trim();
  if (key && key !== "$API_KEY") return key;
  if (isLocalUrl(baseUrl)) return "local";
  return key || "$API_KEY";
}

/**
 * Literal API keys for every custom provider, so the caller can register them in
 * the SDK's authStorage. The already-built session validates model selection and
 * resolves request keys against authStorage, so registering here makes a model
 * added OR edited mid-session take effect immediately — without a restart and
 * without re-saving each model. Env (`$…`) and command (`!…`) refs are left to
 * the SDK to resolve and are skipped.
 */
export function listCustomProviderCredentials(): { provider: string; apiKey: string }[] {
  const data = readModelsJson();
  const out: { provider: string; apiKey: string }[] = [];
  for (const [provider, p] of Object.entries(data.providers)) {
    const key = p.apiKey?.trim();
    if (key && !key.startsWith("$") && !key.startsWith("!")) {
      out.push({ provider, apiKey: key });
    }
  }
  return out;
}

/**
 * One-shot repair, run at startup: rewrite any localhost provider whose key is
 * missing or the hidden `$API_KEY` placeholder to a harmless literal, so ALL
 * affected local models are fixed at once — the user never has to open and
 * re-save each one. Returns how many providers were changed.
 */
export function healCustomModelKeys(): number {
  const data = readModelsJson();
  let changed = 0;
  for (const p of Object.values(data.providers)) {
    const cur = p.apiKey?.trim();
    if ((!cur || cur === "$API_KEY") && isLocalUrl(p.baseUrl ?? "")) {
      p.apiKey = "local";
      changed++;
    }
  }
  if (changed > 0) writeModelsJson(data);
  return changed;
}

export function addCustomModel(config: {
  provider: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  modelId: string;
  modelName?: string;
  reasoning?: boolean;
  contextWindow?: number;
}): { success: boolean; error?: string } {
  const data = readModelsJson();

  const providerKey = slugifyProvider(config.provider);
  if (!providerKey) {
    return { success: false, error: "Provider name must contain a letter or number." };
  }
  const apiKey = normalizeApiKey(config.apiKey, config.baseUrl);
  // Refuse to persist the unresolved placeholder for a remote provider. The SDK
  // reads "$API_KEY" as an env var that is never set, so the provider would be
  // saved successfully and then 401 on every request with no visible cause.
  if (apiKey === "$API_KEY") {
    return { success: false, error: "An API key is required for remote providers." };
  }

  // Create or update the provider.
  if (!data.providers[providerKey]) {
    data.providers[providerKey] = {
      baseUrl: config.baseUrl,
      api: config.api,
      apiKey,
      models: [],
    };
  } else {
    // Update provider-level fields.
    if (config.baseUrl) data.providers[providerKey].baseUrl = config.baseUrl;
    if (config.api) data.providers[providerKey].api = config.api;
    data.providers[providerKey].apiKey = apiKey;
  }

  // Check if model already exists under this provider (upsert by id).
  const models = data.providers[providerKey].models;
  const existing = models.findIndex((m) => m.id === config.modelId);

  const model: CustomModel = {
    id: config.modelId,
    ...(config.modelName ? { name: config.modelName } : {}),
    ...(config.reasoning != null ? { reasoning: config.reasoning } : {}),
    ...(config.contextWindow != null ? { contextWindow: config.contextWindow } : {}),
  };

  if (existing >= 0) {
    models[existing] = model;
  } else {
    models.push(model);
  }

  writeModelsJson(data);
  return { success: true };
}

/**
 * Edit an existing custom model. Handles renaming the provider or model id by
 * removing the original entry and re-adding under the new identity. When no new
 * apiKey is supplied, the original provider's key is preserved (so users don't
 * have to re-enter it just to fix a typo elsewhere).
 */
export function editCustomModel(config: {
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
}): { success: boolean; error?: string } {
  if (!config.provider?.trim() || !config.baseUrl?.trim() || !config.modelId?.trim()) {
    return { success: false, error: "Provider, Base URL, and Model ID are required." };
  }
  const data = readModelsJson();

  // Preserve the current key unless the caller provides a new one, then
  // normalize so a localhost provider never keeps the hidden $API_KEY placeholder.
  const existingKey = data.providers[config.originalProvider]?.apiKey;
  const apiKey = normalizeApiKey(config.apiKey?.trim() || existingKey, config.baseUrl);

  // Remove the original entry first (cleanly handles provider/model rename).
  const original = data.providers[config.originalProvider];
  if (original) {
    original.models = original.models.filter((m) => m.id !== config.originalModelId);
    if (original.models.length === 0) delete data.providers[config.originalProvider];
  }

  // Upsert the edited model under its (possibly new) provider key.
  const providerKey = slugifyProvider(config.provider);
  if (!data.providers[providerKey]) {
    data.providers[providerKey] = { baseUrl: config.baseUrl, api: config.api, apiKey, models: [] };
  } else {
    data.providers[providerKey].baseUrl = config.baseUrl;
    data.providers[providerKey].api = config.api;
    data.providers[providerKey].apiKey = apiKey;
  }

  const models = data.providers[providerKey].models;
  const model: CustomModel = {
    id: config.modelId,
    ...(config.modelName ? { name: config.modelName } : {}),
    ...(config.reasoning != null ? { reasoning: config.reasoning } : {}),
    ...(config.contextWindow != null ? { contextWindow: config.contextWindow } : {}),
  };
  const idx = models.findIndex((m) => m.id === config.modelId);
  if (idx >= 0) models[idx] = model;
  else models.push(model);

  writeModelsJson(data);
  return { success: true };
}

export function removeCustomModel(providerKey: string, modelId: string): { success: boolean } {
  const data = readModelsJson();
  const provider = data.providers[providerKey];
  if (!provider) return { success: true };

  provider.models = provider.models.filter((m) => m.id !== modelId);

  // If no models left, remove the provider entirely.
  if (provider.models.length === 0) {
    delete data.providers[providerKey];
  }

  writeModelsJson(data);
  return { success: true };
}

export function removeCustomProvider(providerKey: string): { success: boolean } {
  const data = readModelsJson();
  delete data.providers[providerKey];
  writeModelsJson(data);
  return { success: true };
}

export function getModelsPath(): string {
  return getModelsJsonPath();
}
