/**
 * Tag Team orchestrator — the test relay engine.
 *
 * For the settings-panel Test button, runs the team's stages sequentially via
 * standalone completeSimple calls (no agent loop, no tab creation): stage 0
 * produces output, that output + the handoff prompt feeds stage 1, etc.
 *
 * The LIVE relay (actual chat usage) is handled in PiSessionManager.prompt()
 * + SessionPool.createHandoffTab, which creates real tabs and uses the full
 * agent session. This module is only for the test preview.
 */

import type { TagTeamTeam, TagTeamStageResult } from "./types";

type ModelRegistry = any;
type AgentMessage = any;

export interface RunTagTeamRelayOptions {
  message: string;
  team: TagTeamTeam;
  modelRegistry: ModelRegistry;
  sessionMessages: AgentMessage[];
}

/**
 * Run a Tag Team relay sequentially for testing. Returns per-stage outputs.
 *
 * Flow: stage 0 answers the message → its output + stage 0's handoffPrompt
 * becomes the input to stage 1 → stage 1 answers → (repeat if >2 stages).
 */
export async function runTagTeamRelay(opts: RunTagTeamRelayOptions): Promise<{
  teamName: string;
  stages: TagTeamStageResult[];
}> {
  const { message, team, modelRegistry, sessionMessages } = opts;

  // Lazily import the SDK + compat (same pattern as moa/engine.ts).
  const sdk = await import("@earendil-works/pi-coding-agent");
  const convertToLlm = (sdk as any).convertToLlm as (msgs: AgentMessage[]) => any[];
  const { completeSimple, extractText } = await importCompat();

  // Build base context from existing session messages.
  const baseLlm = convertToLlm(sessionMessages ?? []);

  const results: TagTeamStageResult[] = [];
  let currentInput = message;

  for (let i = 0; i < team.stages.length; i++) {
    const stage = team.stages[i];
    const model = resolveModel(modelRegistry, stage.provider, stage.modelId);
    const modelName = model?.name ?? stage.modelId;

    if (!model) {
      results.push({ modelName, role: stage.role, error: `Model not found: ${stage.provider}/${stage.modelId}` });
      break;
    }

    const auth = await resolveAuth(modelRegistry, model);
    if (!auth.ok) {
      results.push({ modelName, role: stage.role, error: `No API key for ${stage.provider}/${stage.modelId}` });
      break;
    }

    try {
      // For stage 0, use the user's message directly. For subsequent stages,
      // the handoff prompt + previous output is the input.
      const userContent = i === 0
        ? currentInput
        : `Previous model's output (${results[i - 1]?.modelName ?? "stage " + i}):\n\n${currentInput}\n\n---\n\n${stage.handoffPrompt ?? "Review and improve the work above."}`;

      const context = {
        systemPrompt: stage.role
          ? `You are the ${stage.role} in a Tag Team relay. ${i === 0 ? "Build out the user's request." : "Improve and refine the previous model's work."}`
          : `You are stage ${i + 1} in a Tag Team relay. ${i === 0 ? "Build out the user's request." : "Improve and refine the previous model's work."}`,
        messages: [...baseLlm, { role: "user", content: userContent }],
      };

      const response = await completeSimple(model, context, {
        apiKey: auth.apiKey,
        headers: auth.headers,
      });

      const output = extractText(response);
      results.push({ modelName, role: stage.role, output });
      currentInput = output;
    } catch (err: any) {
      results.push({
        modelName,
        role: stage.role,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }

  return { teamName: team.name, stages: results };
}

// --- Helpers (mirror moa/engine.ts) ---

function resolveModel(modelRegistry: ModelRegistry, provider: string, modelId: string) {
  try {
    return modelRegistry?.find?.(provider, modelId) ?? undefined;
  } catch {
    return undefined;
  }
}

async function resolveAuth(modelRegistry: ModelRegistry, model: any): Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }> {
  try {
    const auth = await modelRegistry?.getApiKeyAndHeaders?.(model);
    if (!auth?.ok) return { ok: false };
    return { ok: true, apiKey: auth.apiKey, headers: auth.headers };
  } catch {
    return { ok: false };
  }
}

/**
 * Import the pi-ai compat module + extract the functions we need. Same
 * resolution approach as moa/engine.ts (the nested-dep workaround).
 */
async function importCompat(): Promise<{
  completeSimple: (model: any, context: any, options: any) => Promise<any>;
  extractText: (message: any) => string;
}> {
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const { existsSync } = await import("node:fs");

  const here = (import.meta as any).url ?? pathToFileURL(process.cwd() + "/").href;
  let dir = dirname(fileURLToPath(here));
  const root = dirname(process.cwd());
  let compatFile: string | null = null;
  while (dir && dir !== root && dir !== dirname(dir)) {
    const candidate = join(
      dir,
      "node_modules",
      "@earendil-works",
      "pi-coding-agent",
      "node_modules",
      "@earendil-works",
      "pi-ai",
      "dist",
      "compat.js",
    );
    if (existsSync(candidate)) {
      compatFile = candidate;
      break;
    }
    dir = dirname(dir);
  }
  if (!compatFile) throw new Error("Could not locate @earendil-works/pi-ai/compat for Tag Team test");

  const mod = await import(pathToFileURL(compatFile).href);
  const complete = mod.completeSimple ?? mod.complete;
  if (!complete) throw new Error("completeSimple not found in pi-ai/compat");

  // extractText — inline since it's trivial and not exported by compat.
  const extractText = (message: any): string => {
    if (!message?.content) return "";
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => c?.text ?? "")
        .join("");
    }
    return "";
  };

  return { completeSimple: complete, extractText };
}
