/**
 * The MOA (Mixture of Agents) engine.
 *
 * Orchestrates fan-out to team models in parallel, aggregates their responses,
 * and (in advanced mode) scores + re-queries low-confidence responses.
 *
 * Uses the shared ModelRuntime's `completeSimple` for standalone model calls
 * (no agent loop; auth is resolved internally by the runtime), and
 * `convertToLlm` to convert the session's agent messages into LLM format.
 */

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { MoaTeam, MoaMemberResult, MoaResult, MoaProgressEvent } from "./types";
import { memberSystemPrompt, aggregatorSystemPrompt, reQueryPrompt } from "./prompts";

// Lazy import the SDK — it's ESM and large, so we only load it when MOA runs.
async function getSdk() {
  return await import("@earendil-works/pi-coding-agent");
}

// Types from the SDK (lazily resolved at call time).
type Model = any;
type Context = any;
type AssistantMessage = any;
type AgentMessage = any;

export interface RunMoaOptions {
  /** The user's prompt that triggered this MOA run. */
  message: string;
  /** The team to use. */
  team: MoaTeam;
  /** The shared model runtime (from PiSessionManager.deps). */
  modelRuntime: ModelRuntime;
  /** Existing session messages for context. */
  sessionMessages: AgentMessage[];
  /** Basic = single pass; Advanced = score + re-query loop. */
  mode: "basic" | "advanced";
  /** Advanced: max re-query layers (default 3). */
  maxLayers?: number;
  /** Advanced: min confidence before re-query (default 6). */
  confidenceThreshold?: number;
  /** Optional signal to cancel the MOA run. */
  signal?: AbortSignal;
  /** Progress callback (emitted to the renderer via IPC). */
  onProgress?: (event: MoaProgressEvent) => void;
}

/**
 * Run the MOA pipeline: fan-out → aggregate → (score → re-query loop in advanced).
 *
 * Returns the synthesized briefing + per-member results. Throws only if ALL
 * members fail (caller should catch and skip MOA enrichment in that case).
 */
export async function runMoa(opts: RunMoaOptions): Promise<MoaResult> {
  const { message, team, modelRuntime, sessionMessages, mode, onProgress, signal } = opts;
  const maxLayers = opts.maxLayers ?? 3;
  const confidenceThreshold = opts.confidenceThreshold ?? 6;

  if (team.members.length === 0) {
    throw new Error(`Pi Routing team "${team.name}" has no members.`);
  }

  const sdk = await getSdk();
  const convertToLlm = (sdk as any).convertToLlm as (msgs: AgentMessage[]) => any[];

  // Build the shared LLM context from existing session messages + the new user message.
  const llmMessages = convertToLlm(sessionMessages);
  llmMessages.push({ role: "user", content: message });

  // --- Phase 1: Fan out to all team members in parallel ---
  onProgress?.({
    phase: "fanning-out",
    layer: 1,
    progress: 10,
    message: `Consulting ${team.members.length} models…`,
  });

  let memberResults = await fanOut(team.members, llmMessages, modelRuntime, signal, (done, total, modelName) => {
    onProgress?.({
      phase: "member-done",
      layer: 1,
      member: modelName,
      progress: 10 + Math.round((done / total) * 35),
      message: `${done}/${total} models responded`,
    });
  });

  if (!memberResults.some((result) => result.response?.trim())) {
    const reasons = memberResults
      .map((result) => result.error)
      .filter(Boolean)
      .join("; ");
    throw new Error(`All Pi Routing team members failed${reasons ? `: ${reasons}` : "."}`);
  }

  onProgress?.({
    phase: "aggregating",
    layer: 1,
    progress: 50,
    message: "Synthesizing team responses…",
  });

  // --- Phase 2: Aggregate ---
  let aggregatorOutput = await aggregate(
    message,
    memberResults,
    team.aggregatorModel,
    modelRuntime,
    llmMessages,
    mode === "advanced",
    confidenceThreshold,
    signal,
  );

  let layers = 1;
  let scores = aggregatorOutput.scores;

  // Attach scores to member results (advanced mode only).
  if (scores) {
    memberResults = memberResults.map((r) => {
      const scoreEntry = scores!.find((s) => s.member === r.modelName || s.member === r.modelId);
      return { ...r, score: scoreEntry?.score };
    });
  }

  // --- Phase 3: Advanced mode — score + re-query loop ---
  if (mode === "advanced" && scores) {
    while (layers < maxLayers) {
      // Bail before spending another round of API calls if the user cancelled.
      if (signal?.aborted) break;
      const lowScorers = memberResults.filter(
        (r) => r.score != null && r.score < confidenceThreshold && r.response,
      );
      if (lowScorers.length === 0) break;

      layers++;
      onProgress?.({
        phase: "re-querying",
        layer: layers,
        progress: 50 + (layers / maxLayers) * 30,
        message: `Re-querying ${lowScorers.length} models (layer ${layers})…`,
      });

      // Re-query the low-scoring members with refined prompts.
      const reQueried = await Promise.allSettled(
        lowScorers.map((r) =>
          reQueryMember(r, message, aggregatorOutput.feedback, modelRuntime, signal),
        ),
      );

      // Merge re-queried responses back into memberResults.
      memberResults = memberResults.map((r) => {
        const idx = lowScorers.indexOf(r);
        if (idx === -1) return r;
        const result = reQueried[idx];
        if (result?.status === "fulfilled" && result.value) {
          return { ...r, response: result.value };
        }
        return r;
      });

      // Re-aggregate with the improved responses.
      onProgress?.({ phase: "scoring", layer: layers, progress: 60 + (layers / maxLayers) * 20 });
      aggregatorOutput = await aggregate(
        message,
        memberResults,
        team.aggregatorModel,
        modelRuntime,
        llmMessages,
        true,
        confidenceThreshold,
        signal,
      );
      scores = aggregatorOutput.scores;
      // If the aggregator didn't emit parseable scores on this re-query pass,
      // stop re-querying — the members' existing responses are the best we
      // have, and looping again would waste API calls without new signal.
      if (!scores) break;
      memberResults = memberResults.map((r) => {
        const scoreEntry = scores!.find(
          (s) => s.member === r.modelName || s.member === r.modelId,
        );
        return { ...r, score: scoreEntry?.score };
      });
    }
  }

  const confidence =
    scores && scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : null;

  onProgress?.({ phase: "done", layer: layers, progress: 100 });

  return {
    briefing: aggregatorOutput.briefing,
    teamResponses: memberResults,
    layers,
    confidence: confidence == null ? null : Math.round(confidence * 10) / 10,
    teamName: team.name,
  };
}

// --- Fan-out ---

async function fanOut(
  members: MoaTeam["members"],
  llmMessages: any[],
  modelRuntime: ModelRuntime,
  signal?: AbortSignal,
  onMemberDone?: (doneCount: number, total: number, modelName: string) => void,
): Promise<MoaMemberResult[]> {
  let doneCount = 0;
  const total = members.length;

  const results = await Promise.allSettled(
    members.map(async (member) => {
      const model = resolveModel(modelRuntime, member.provider, member.modelId);
      if (!model) throw new Error(`Model not found: ${member.provider}/${member.modelId}`);

      const context: Context = {
        systemPrompt: memberSystemPrompt(member.role),
        messages: llmMessages,
      };

      // ModelRuntime resolves auth internally from the model's provider.
      const response = await modelRuntime.completeSimple(model, context, { signal });

      const text = extractText(response);
      // Emit per-member progress as each model finishes.
      doneCount++;
      const modelName =
        resolveModel(modelRuntime, member.provider, member.modelId)?.name ?? member.modelId;
      onMemberDone?.(doneCount, total, modelName);
      return text;
    }),
  );

  return members.map((member, i) => {
    const result = results[i];
    const modelName =
      resolveModel(modelRuntime, member.provider, member.modelId)?.name ?? member.modelId;
    if (result?.status === "fulfilled") {
      return {
        provider: member.provider,
        modelId: member.modelId,
        modelName,
        role: member.role,
        response: result.value,
      };
    }
    return {
      provider: member.provider,
      modelId: member.modelId,
      modelName,
      role: member.role,
      error:
        result?.status === "rejected"
          ? String(result.reason?.message ?? result.reason)
          : "Unknown error",
    };
  });
}

// --- Aggregation ---

interface AggregatorOutput {
  briefing: string;
  scores?: { member: string; score: number; reason: string }[];
  feedback: string;
}

export function normalizeMoaScores(
  value: unknown,
): { member: string; score: number; reason: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as any).member !== "string" ||
      typeof (entry as any).score !== "number" ||
      !Number.isFinite((entry as any).score)
    ) {
      return [];
    }
    return [
      {
        member: (entry as any).member,
        score: Math.min(10, Math.max(0, (entry as any).score)),
        reason: typeof (entry as any).reason === "string" ? (entry as any).reason : "",
      },
    ];
  });
  return normalized.length > 0 ? normalized : undefined;
}

async function aggregate(
  userMessage: string,
  memberResults: MoaMemberResult[],
  aggregatorSpec: { provider: string; modelId: string },
  modelRuntime: ModelRuntime,
  llmMessages: any[],
  advanced: boolean,
  confidenceThreshold: number,
  signal?: AbortSignal,
): Promise<AggregatorOutput> {
  const model = resolveModel(modelRuntime, aggregatorSpec.provider, aggregatorSpec.modelId);
  if (!model)
    throw new Error(
      `Aggregator model not found: ${aggregatorSpec.provider}/${aggregatorSpec.modelId}`,
    );

  // Build the aggregator's context: the user's message + each member's response.
  const teamResponsesText = memberResults
    .filter((r) => r.response)
    .map(
      (r, i) =>
        `--- Team Member ${i + 1}: ${r.modelName}${r.role ? ` (${r.role})` : ""} ---\n${r.response}`,
    )
    .join("\n\n");

  const aggregatorUserMessage = `User's original request:
${userMessage}

Team member responses:
${teamResponsesText}

${aggregatorSystemPrompt(advanced, confidenceThreshold)}`;

  const context: Context = {
    systemPrompt: "You are an expert aggregator. Synthesize the team's responses into a briefing.",
    messages: [{ role: "user", content: aggregatorUserMessage }],
  };

  const response = await modelRuntime.completeSimple(model, context, { signal });

  const text = extractText(response);

  // Parse scores from advanced mode output.
  let scores: AggregatorOutput["scores"] | undefined;
  let briefing = text;
  let feedback = "";

  if (advanced) {
    const scoresMatch = text.match(/<SCORES>([\s\S]*?)<\/SCORES>/);
    if (scoresMatch) {
      try {
        scores = normalizeMoaScores(JSON.parse(scoresMatch[1].trim()));
        briefing = text.slice(0, scoresMatch.index).trim();
        feedback = scores?.map((s) => `${s.member}: ${s.reason}`).join("; ") ?? "";
      } catch {
        // If JSON parsing fails, keep the full text as briefing.
      }
    }
  }

  return { briefing, scores, feedback };
}

// --- Re-query a single member ---

async function reQueryMember(
  member: MoaMemberResult,
  userMessage: string,
  feedback: string,
  modelRuntime: ModelRuntime,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const model = resolveModel(modelRuntime, member.provider, member.modelId);
  if (!model) return undefined;

  const context: Context = {
    systemPrompt: memberSystemPrompt(member.role),
    messages: [
      {
        role: "user",
        content: reQueryPrompt(member.modelName, member.response ?? "", feedback, userMessage),
      },
    ],
  };

  const response = await modelRuntime.completeSimple(model, context, { signal });

  return extractText(response);
}

// --- SDK helpers ---

function resolveModel(
  modelRuntime: ModelRuntime,
  provider: string,
  modelId: string,
): Model | undefined {
  try {
    return modelRuntime?.getModel?.(provider, modelId) ?? undefined;
  } catch {
    return undefined;
  }
}

function extractText(message: AssistantMessage): string {
  if (!message?.content) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
  }
  return "";
}
