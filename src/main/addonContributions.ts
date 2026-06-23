/**
 * Addon contributions (Tier 2) — declarative panels & status items that
 * extensions contribute via their package.json `pi.panels` / `pi.statusItems`.
 *
 * The host enumerates installed packages, validates their contributions, and
 * renders them (sidebar panels + status-bar items). All declarative — no code
 * runs from the manifest. See docs/EXTENSION_SETTINGS.md.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import type { PiSettingsField } from "./extensionDetail";

export interface PanelActionDef {
  label: string;
  command?: string; // runs as a chat command, e.g. "/my-cmd"
  prompt?: string; // sent as a chat prompt
  url?: string; // opened in the OS browser
}

export type PanelSection =
  | { type: "markdown"; content: string }
  | { type: "fields"; key: string; fields: PiSettingsField[]; values?: Record<string, unknown> }
  | { type: "actions"; actions: PanelActionDef[] }
  | { type: "list"; title?: string; items: string[] };

export interface PanelContribution {
  id: string; // namespaced: "<package>:<id>"
  title: string;
  icon?: string;
  source: string; // package name
  sections: PanelSection[];
}

export interface StatusItemContribution {
  id: string;
  label: string;
  icon?: string;
  panelId?: string; // namespaced panel id to open on click
  source: string;
}

const AGENT_DIR = join(homedir(), ".pi", "agent");
const SETTINGS_PATH = join(AGENT_DIR, "settings.json");
const NODE_MODULES = join(AGENT_DIR, "npm", "node_modules");

function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

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

function normalizeField(f: any): PiSettingsField | null {
  if (!f || typeof f.key !== "string") return null;
  return {
    key: f.key,
    label: typeof f.label === "string" ? f.label : f.key,
    type: (["string", "number", "boolean", "select", "secret"].includes(f.type) ? f.type : "string") as PiSettingsField["type"],
    default: f.default,
    description: typeof f.description === "string" ? f.description : undefined,
    options: Array.isArray(f.options) ? f.options.map(String) : undefined,
  };
}

function normalizeSection(raw: any, settings: any): PanelSection | null {
  if (!raw || typeof raw.type !== "string") return null;
  switch (raw.type) {
    case "markdown":
      return typeof raw.content === "string" ? { type: "markdown", content: raw.content } : null;
    case "fields": {
      if (typeof raw.key !== "string" || !Array.isArray(raw.fields)) return null;
      const fields = raw.fields.map(normalizeField).filter(Boolean) as PiSettingsField[];
      if (fields.length === 0) return null;
      const block = settings[raw.key];
      return { type: "fields", key: raw.key, fields, values: block && typeof block === "object" ? block : {} };
    }
    case "actions": {
      if (!Array.isArray(raw.actions)) return null;
      const actions: PanelActionDef[] = raw.actions
        .filter((a: any) => a && typeof a.label === "string")
        .map((a: any) => ({
          label: a.label,
          command: typeof a.command === "string" ? a.command : undefined,
          prompt: typeof a.prompt === "string" ? a.prompt : undefined,
          url: typeof a.url === "string" ? a.url : undefined,
        }));
      return actions.length ? { type: "actions", actions } : null;
    }
    case "list": {
      if (!Array.isArray(raw.items)) return null;
      return { type: "list", title: typeof raw.title === "string" ? raw.title : undefined, items: raw.items.map(String) };
    }
    default:
      return null;
  }
}

function normalizePanel(raw: any, pkgName: string, settings: any): PanelContribution | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map((s: any) => normalizeSection(s, settings))
    .filter(Boolean) as PanelSection[];
  return {
    id: `${pkgName}:${raw.id}`,
    title: raw.title,
    icon: typeof raw.icon === "string" ? raw.icon : undefined,
    source: pkgName,
    sections,
  };
}

function normalizeStatusItem(raw: any, pkgName: string): StatusItemContribution | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.label !== "string") return null;
  return {
    id: `${pkgName}:${raw.id}`,
    label: raw.label,
    icon: typeof raw.icon === "string" ? raw.icon : undefined,
    panelId: typeof raw.panelId === "string" ? `${pkgName}:${raw.panelId}` : undefined,
    source: pkgName,
  };
}

/** Enumerate panel + status-item contributions across configured packages. */
export function getAddonContributions(): { panels: PanelContribution[]; statusItems: StatusItemContribution[] } {
  const settings = readJson(SETTINGS_PATH) ?? {};
  const specs: string[] = [...(settings.packages ?? []), ...(settings.projectPackages ?? [])];
  const panels: PanelContribution[] = [];
  const statusItems: StatusItemContribution[] = [];
  const seenPanels = new Set<string>();

  for (const spec of specs) {
    const pkgName = parsePackageName(String(spec));
    const pkg = readJson(join(NODE_MODULES, pkgName, "package.json"));
    if (!pkg?.pi) continue;

    for (const raw of Array.isArray(pkg.pi.panels) ? pkg.pi.panels : []) {
      const panel = normalizePanel(raw, pkgName, settings);
      if (panel && !seenPanels.has(panel.id)) {
        seenPanels.add(panel.id);
        panels.push(panel);
      }
    }
    for (const raw of Array.isArray(pkg.pi.statusItems) ? pkg.pi.statusItems : []) {
      const item = normalizeStatusItem(raw, pkgName);
      if (item) statusItems.push(item);
    }
  }

  return { panels, statusItems };
}
