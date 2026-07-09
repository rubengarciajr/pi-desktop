import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * Desktop-only UI preferences. These are app concerns (not Pi SDK settings),
 * so they live in a file under userData — the same reliable location as
 * favorites. Renderer localStorage is unreliable under the file:// origin.
 */
export interface AppSettings {
  /**
   * Horizontal padding around messages in the conversation. The GUI equivalent
   * of Pi's terminal `outputPad` setting.
   */
  messageDensity: "compact" | "comfortable" | "spacious";
  /**
   * Command used to open the prompt in an external editor (e.g. "code --wait").
   * Empty falls back to Pi's settings.json `externalEditor`, then $VISUAL /
   * $EDITOR. GUI editors need a blocking flag (code --wait, subl -w, …).
   */
  externalEditor: string;
}

const DEFAULTS: AppSettings = {
  messageDensity: "comfortable",
  externalEditor: "",
};

const SETTINGS_FILE = join(app.getPath("userData"), "app-settings.json");

export function loadAppSettings(): AppSettings {
  try {
    if (!existsSync(SETTINGS_FILE)) return { ...DEFAULTS };
    const parsed = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    if (!parsed || typeof parsed !== "object") return { ...DEFAULTS };
    const density = parsed.messageDensity;
    return {
      messageDensity:
        density === "compact" || density === "comfortable" || density === "spacious"
          ? density
          : DEFAULTS.messageDensity,
      externalEditor:
        typeof parsed.externalEditor === "string" ? parsed.externalEditor : DEFAULTS.externalEditor,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadAppSettings(), ...patch };
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf-8");
  } catch (err) {
    console.error("[pi-desktop] Failed to save app settings:", err);
  }
  return next;
}
