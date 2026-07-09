import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { loadAppSettings } from "./appSettings";

const PI_SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");

/**
 * Resolve the editor command, mirroring Pi's CLI `externalEditor` behavior:
 * an explicit desktop override wins, then Pi's own settings.json, then the
 * standard $VISUAL / $EDITOR environment variables.
 */
function resolveEditorCommand(): string | null {
  const fromApp = loadAppSettings().externalEditor?.trim();
  if (fromApp) return fromApp;

  try {
    const parsed = JSON.parse(readFileSync(PI_SETTINGS_PATH, "utf-8"));
    if (parsed && typeof parsed.externalEditor === "string" && parsed.externalEditor.trim()) {
      return parsed.externalEditor.trim();
    }
  } catch {
    /* no Pi settings.json / not configured — fall through to env */
  }

  const env = process.env.VISUAL?.trim() || process.env.EDITOR?.trim();
  return env || null;
}

/**
 * Open `text` in the configured external editor, wait for it to close, and
 * return the edited contents. The GUI process has no TTY, so terminal editors
 * (vim/nano) won't work — users should configure a GUI editor with a blocking
 * flag (e.g. "code --wait", "subl -w", "cursor --wait").
 */
export async function openInExternalEditor(
  text: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const command = resolveEditorCommand();
  if (!command) {
    return {
      ok: false,
      error:
        "No external editor configured. Set one in Settings → Appearance (e.g. \"code --wait\"), or via $VISUAL/$EDITOR.",
    };
  }

  const parts = command.split(/\s+/).filter(Boolean);
  const bin = parts[0];
  const args = parts.slice(1);

  const tmpFile = join(tmpdir(), `pi-desktop-prompt-${process.pid}-${Date.now()}.md`);
  try {
    writeFileSync(tmpFile, text ?? "", "utf-8");
  } catch (err) {
    return { ok: false, error: `Could not write temp file: ${err instanceof Error ? err.message : String(err)}` };
  }

  const exitError = await new Promise<string | null>((resolve) => {
    try {
      const child = spawn(bin, [...args, tmpFile], { stdio: "ignore" });
      child.on("error", (err) => {
        resolve(
          (err as NodeJS.ErrnoException).code === "ENOENT"
            ? `Editor not found: "${bin}". Configure a GUI editor with a blocking flag (e.g. "code --wait").`
            : err.message,
        );
      });
      child.on("close", (code) => {
        resolve(code === 0 || code === null ? null : `Editor exited with code ${code}.`);
      });
    } catch (err) {
      resolve(err instanceof Error ? err.message : String(err));
    }
  });

  try {
    if (exitError) {
      return { ok: false, error: exitError };
    }
    const edited = readFileSync(tmpFile, "utf-8");
    return { ok: true, text: edited };
  } catch (err) {
    return { ok: false, error: `Could not read edited file: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* best-effort cleanup */
    }
  }
}
