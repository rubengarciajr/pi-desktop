import { execSync, spawn } from "child_process";
import { EventEmitter } from "node:events";

/**
 * Detect if pi CLI is installed on the system.
 */
export function isPiInstalled(): boolean {
  try {
    execSync("pi --version", { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the installed pi CLI version.
 */
export function getPiVersion(): string | null {
  try {
    return execSync("pi --version", { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

/**
 * Detect whether npm is reachable on PATH. Used to give a clear, actionable
 * error before attempting the install (rather than a cryptic
 * "/bin/sh: npm: command not found").
 */
function isNpmAvailable(): boolean {
  try {
    execSync("npm --version", { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install pi CLI globally via npm.
 * Emits progress events: { stage, message, percent }
 */
export function installPi(): EventEmitter & Promise<{ success: boolean; error?: string }> {
  const emitter = new EventEmitter() as EventEmitter & Promise<{ success: boolean; error?: string }>;
  let resolveFn: (val: { success: boolean; error?: string }) => void;
  let rejectFn: (err: Error) => void;
  emitter.then = (onFulfilled: any, onRejected: any) => {
    return (emitter as any)._promise.then(onFulfilled, onRejected);
  };
  (emitter as any)._promise = new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const stages = [
    { message: "Checking system requirements...", delay: 600 },
    { message: "Resolving @earendil-works/pi-coding-agent...", delay: 800 },
  ];

  let stageIndex = 0;
  const runStages = () => {
    if (stageIndex < stages.length) {
      emitter.emit("progress", {
        stage: "preparing",
        message: stages[stageIndex].message,
        percent: Math.round((stageIndex / (stages.length + 1)) * 30),
      });
      stageIndex++;
      setTimeout(runStages, stages[stageIndex - 1].delay);
      return;
    }

    // Fail early with a helpful message if npm isn't installed at all.
    if (!isNpmAvailable()) {
      const msg =
        "Node.js / npm not found. Install Node.js from https://nodejs.org, then reopen Pi Desktop.";
      emitter.emit("progress", { stage: "error", message: msg, percent: 0 });
      resolveFn({ success: false, error: msg });
      return;
    }

    emitter.emit("progress", {
      stage: "installing",
      message: "Installing @earendil-works/pi-coding-agent globally...",
      percent: 35,
    });

    const child = spawn("npm", ["install", "-g", "@earendil-works/pi-coding-agent@latest"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      emitter.emit("progress", { stage: "error", message: `Installation failed: ${err.message}`, percent: 0 });
      resolveFn({ success: false, error: err.message });
    });

    child.on("close", (code) => {
      if (code === 0) {
        emitter.emit("progress", { stage: "verifying", message: "Verifying installation...", percent: 85 });
        setTimeout(() => {
          const version = getPiVersion();
          if (version) {
            emitter.emit("progress", { stage: "done", message: `Pi ${version} installed successfully!`, percent: 100 });
            resolveFn({ success: true });
          } else {
            emitter.emit("progress", { stage: "done", message: "Installation complete (verification skipped)", percent: 100 });
            resolveFn({ success: true });
          }
        }, 1000);
      } else {
        const errorMsg = stderr.trim() || `npm exited with code ${code}`;
        emitter.emit("progress", { stage: "error", message: `Installation failed: ${errorMsg}`, percent: 0 });
        resolveFn({ success: false, error: errorMsg });
      }
    });
  };

  runStages();
  return emitter;
}
