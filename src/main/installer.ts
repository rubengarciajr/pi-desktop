import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pExecFile = promisify(execFile);

/**
 * Detect whether the pi CLI is installed and, if so, its version — in a single
 * subprocess. The CLI is entirely optional (Pi Desktop runs the agent SDK
 * in-process); this only powers the "Pi CLI" status row in System settings.
 */
export async function checkPiInstalled(): Promise<{ installed: boolean; version: string | null }> {
  try {
    const { stdout } = await pExecFile("pi", ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    return { installed: true, version: stdout.trim() };
  } catch {
    return { installed: false, version: null };
  }
}
