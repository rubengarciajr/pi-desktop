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

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { TagTeamTeam, TagTeamStageResult } from "./types";
import { buildHandoffMessage, getHandoffPrompt } from "./relay";

type AgentMessage = any;

export interface RunTagTeamRelayOptions {
  message: string;
  team: TagTeamTeam;
  modelRuntime: ModelRuntime;
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
  const { message, team, modelRuntime, sessionMessages, signal } = opts;

  // Lazily import the SDK for convertToLlm (ESM + large).
  const sdk = await import("@earendil-works/pi-coding-agent");
  const convertToLlm = (sdk as any).convertToLlm as (msgs: AgentMessage[]) => any[];

  // Build base context from existing session messages.
  const baseLlm = convertToLlm(sessionMessages ?? []);

  const results: TagTeamStageResult[] = [];
  let currentInput = message;

  for (let i = 0; i < team.stages.length; i++) {
    // Bail out early if the caller cancelled (e.g. user hit Stop).
    if (signal?.aborted) break;

    const stage = team.stages[i];
    const model = resolveModel(modelRuntime, stage.provider, stage.modelId);
    const modelName = model?.name ?? stage.modelId;

    if (!model) {
      results.push({
        modelName,
        role: stage.role,
        error: `Model not found: ${stage.provider}/${stage.modelId}`,
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

      // ModelRuntime resolves auth internally from the model's provider.
      const response = await modelRuntime.completeSimple(model, context, { signal });

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

function resolveModel(modelRuntime: ModelRuntime, provider: string, modelId: string) {
  try {
    return modelRuntime?.getModel?.(provider, modelId) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Flatten an assistant message's content to plain text (text blocks only). */
function extractText(message: any): string {
  if (!message?.content) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c?.text ?? "")
      .join("");
  }
  return "";
}
