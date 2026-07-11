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
import { buildHandoffMessage, getHandoffPrompt } from "./relay";

type ModelRegistry = any;
type AgentMessage = any;

export interface RunTagTeamRelayOptions {
  message: string;
  team: TagTeamTeam;
  modelRegistry: ModelRegistry;
  sessionMessages: AgentMessage[];
  /** Optional abort signal so a stuck multi-stage relay can be cancelled. */
  signal?: AbortSignal;
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
  const { message, team, modelRegistry, sessionMessages, signal } = opts;

  // Lazily import the SDK + compat (same pattern as moa/engine.ts).
  const sdk = await import("@earendil-works/pi-coding-agent");
  const convertToLlm = (sdk as any).convertToLlm as (msgs: AgentMessage[]) => any[];
  const { completeSimple, extractText } = await importCompat();

  // Build base context from existing session messages.
  const baseLlm = convertToLlm(sessionMessages ?? []);

  const results: TagTeamStageResult[] = [];
  let currentInput = message;

  for (let i = 0; i < team.stages.length; i++) {
    // Bail out early if the caller cancelled (e.g. user hit Stop).
    if (signal?.aborted) break;

    const stage = team.stages[i];
    const model = resolveModel(modelRegistry, stage.provider, stage.modelId);
    const modelName = model?.name ?? stage.modelId;

    if (!model) {
      results.push({
        modelName,
        role: stage.role,
        error: `Model not found: ${stage.provider}/${stage.modelId}`,
      });
      break;
    }

    const auth = await resolveAuth(modelRegistry, model);
    if (!auth.ok) {
      results.push({
        modelName,
        role: stage.role,
        error: `No API key for ${stage.provider}/${stage.modelId}`,
      });
      break;
    }

    try {
      // For stage 0, use the user's message directly. For subsequent stages,
      // the handoff prompt + previous output is the input.
      const userContent =
        i === 0
          ? currentInput
          : buildHandoffMessage(
              currentInput,
              getHandoffPrompt(team, i - 1),
              results[i - 1]?.modelName ?? `stage ${i}`,
            );

      const context = {
        systemPrompt: stage.role
          ? `You are the ${stage.role} in a Tag Team relay. ${i === 0 ? "Build out the user's request." : "Improve and refine the previous model's work."}`
          : `You are stage ${i + 1} in a Tag Team relay. ${i === 0 ? "Build out the user's request." : "Improve and refine the previous model's work."}`,
        messages: [...baseLlm, { role: "user", content: userContent }],
      };

      const response = await completeSimple(model, context, {
        apiKey: auth.apiKey,
        headers: auth.headers,
        signal,
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

async function resolveAuth(
  modelRegistry: ModelRegistry,
  model: any,
): Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }> {
  try {
    const auth = await modelRegistry?.getApiKeyAndHeaders?.(model);
    if (!auth?.ok) return { ok: false };
    return { ok: true, apiKey: auth.apiKey, headers: auth.headers };
  } catch {
    return { ok: false };
  }
}

/**
 * Import the pi-ai compat module + extract the functions we need. Delegates the
 * nested-dep resolution to moa/engine's cached getCompat (see the long comment
 * there for why direct file-path import is required) so the workaround lives in
 * exactly one place.
 */
async function importCompat(): Promise<{
  completeSimple: (model: any, context: any, options: any) => Promise<any>;
  extractText: (message: any) => string;
}> {
  const { getCompat } = await import("../moa/engine");
  const mod = await getCompat();
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
