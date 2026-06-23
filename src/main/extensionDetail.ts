/**
 * Extension detail + settings — powers the per-extension Settings/Docs panel.
 *
 * Reads an installed package's metadata, README, and an optional declarative
 * settings schema (the `pi.settings` convention — see docs/EXTENSION_SETTINGS.md),
 * and reads/writes the extension's config block in ~/.pi/agent/settings.json.
 *
 * Extensions that don't declare `pi.settings` can still get a form via a small
 * built-in fallback map for popular packages; otherwise the panel shows docs +
 * a raw-config editor.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export type PiSettingsFieldType = "string" | "number" | "boolean" | "select" | "secret";

export interface PiSettingsField {
  key: string;
  label: string;
  type: PiSettingsFieldType;
  default?: unknown;
  description?: string;
  options?: string[];
}

export interface PiSettingsSchema {
  /** settings.json key this extension reads its config from. */
  key: string;
  /** Optional docs file (relative to package root); falls back to README.md. */
  docs?: string;
  fields: PiSettingsField[];
}

export interface ExtensionMeta {
  name: string;
  version?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  source: string;
}

export interface ExtensionDetail {
  meta: ExtensionMeta;
  readme: string | null;
  schema: PiSettingsSchema | null;
  values: Record<string, unknown>;
}

const AGENT_DIR = join(homedir(), ".pi", "agent");
const SETTINGS_PATH = join(AGENT_DIR, "settings.json");
const NODE_MODULES = join(AGENT_DIR, "npm", "node_modules");

/**
 * Built-in settings schemas for popular packages that don't yet declare
 * `pi.settings`, so they get a form immediately. Keyed by package name.
 */
const FALLBACK_SCHEMAS: Record<string, PiSettingsSchema> = {
  "@samfp/pi-memory": {
    key: "memory",
    fields: [
      { key: "perTurnInjection", label: "Per-turn injection", type: "boolean", default: true, description: "Inject relevant memory each turn." },
      {
        key: "lessonInjection",
        label: "Lesson injection",
        type: "select",
        options: ["off", "selective", "all"],
        default: "selective",
        description: "How learned lessons are added to context.",
      },
      { key: "consolidationModel", label: "Consolidation model", type: "string", default: "openai/gpt-4.1-mini", description: "Model used to consolidate memory." },
      { key: "localPath", label: "Local path", type: "string", description: "Override the memory store location." },
    ],
  },
};

function parsePackageName(source: string): string {
  const s = source.replace(/^npm:/, "").trim();
  if (s.startsWith("@")) {
    const slash = s.indexOf("/");
    const at = slash >= 0 ? s.indexOf("@", slash) : -1;
    return at > 0 ? s.slice(0, at) : s;
  }
  const at = s.indexOf("@");
  return at > 0 ? s.slice(0, at) : s;
}

function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function normalizeSchema(raw: any): PiSettingsSchema | null {
  if (!raw || typeof raw !== "object" || typeof raw.key !== "string" || !Array.isArray(raw.fields)) {
    return null;
  }
  const fields: PiSettingsField[] = raw.fields
    .filter((f: any) => f && typeof f.key === "string")
    .map((f: any) => ({
      key: f.key,
      label: typeof f.label === "string" ? f.label : f.key,
      type: (["string", "number", "boolean", "select", "secret"].includes(f.type) ? f.type : "string") as PiSettingsFieldType,
      default: f.default,
      description: typeof f.description === "string" ? f.description : undefined,
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    }));
  return { key: raw.key, docs: typeof raw.docs === "string" ? raw.docs : undefined, fields };
}

export function getExtensionDetail(source: string): ExtensionDetail {
  const pkgName = parsePackageName(source);
  const installDir = join(NODE_MODULES, pkgName);
  const pkg = readJson(join(installDir, "package.json")) ?? {};

  const meta: ExtensionMeta = {
    name: pkg.name ?? pkgName,
    version: pkg.version,
    description: pkg.description,
    homepage: pkg.homepage,
    repository: typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url,
    source,
  };

  const schema = normalizeSchema(pkg.pi?.settings) ?? FALLBACK_SCHEMAS[pkgName] ?? null;

  // Docs: pi.settings.docs (if present) else README.md.
  let readme: string | null = null;
  const docsCandidates = [schema?.docs, "README.md", "readme.md"].filter(Boolean) as string[];
  for (const cand of docsCandidates) {
    const p = join(installDir, cand);
    if (existsSync(p)) {
      try {
        readme = readFileSync(p, "utf-8");
        break;
      } catch {}
    }
  }

  // Current config values from settings.json under schema.key.
  let values: Record<string, unknown> = {};
  if (schema) {
    const settings = readJson(SETTINGS_PATH) ?? {};
    const block = settings[schema.key];
    if (block && typeof block === "object") values = block;
  }

  return { meta, readme, schema, values };
}

/** Merge `values` into settings.json under `key`. */
export function setExtensionConfig(key: string, values: Record<string, unknown>): { success: boolean } {
  if (!key) return { success: false };
  const settings = readJson(SETTINGS_PATH) ?? {};
  settings[key] = { ...(settings[key] ?? {}), ...values };
  try {
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    return { success: true };
  } catch {
    return { success: false };
  }
}
