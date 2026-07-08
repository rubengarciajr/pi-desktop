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

  const providerKey = config.provider.toLowerCase().replace(/\s+/g, "-");

  // Create or update the provider.
  if (!data.providers[providerKey]) {
    data.providers[providerKey] = {
      baseUrl: config.baseUrl,
      api: config.api,
      apiKey: config.apiKey,
      models: [],
    };
  } else {
    // Update provider-level fields.
    if (config.baseUrl) data.providers[providerKey].baseUrl = config.baseUrl;
    if (config.api) data.providers[providerKey].api = config.api;
    if (config.apiKey) data.providers[providerKey].apiKey = config.apiKey;
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

  // Preserve the current key unless the caller provides a new one.
  const existingKey = data.providers[config.originalProvider]?.apiKey;
  const apiKey = config.apiKey?.trim() || existingKey || "$API_KEY";

  // Remove the original entry first (cleanly handles provider/model rename).
  const original = data.providers[config.originalProvider];
  if (original) {
    original.models = original.models.filter((m) => m.id !== config.originalModelId);
    if (original.models.length === 0) delete data.providers[config.originalProvider];
  }

  // Upsert the edited model under its (possibly new) provider key.
  const providerKey = config.provider.toLowerCase().replace(/\s+/g, "-");
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
