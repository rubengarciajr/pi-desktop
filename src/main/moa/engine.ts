/**
 * The MOA (Mixture of Agents) engine.
 *
 * Orchestrates fan-out to team models in parallel, aggregates their responses,
 * and (in advanced mode) scores + re-queries low-confidence responses.
 *
 * Uses the Pi SDK's `completeSimple` for standalone model calls (no agent loop),
 * and `convertToLlm` to convert the session's agent messages into LLM format.
 */

import type { MoaTeam, MoaMemberResult, MoaResult, MoaProgressEvent } from "./types";
import { memberSystemPrompt, aggregatorSystemPrompt, reQueryPrompt } from "./prompts";

// Lazy import the SDK — it's ESM and large, so we only load it when MOA runs.
async function getSdk() {
  return await import("@earendil-works/pi-coding-agent");
}

// Types from the SDK (lazily resolved at call time).
type ModelRegistry = any;
type Model = any;
type Context = any;
type AssistantMessage = any;
type AgentMessage = any;

export interface RunMoaOptions {
  /** The user's prompt that triggered this MOA run. */
  message: string;
  /** The team to use. */
  team: MoaTeam;
  /** The live model registry (from PiSessionManager.deps). */
  modelRegistry: ModelRegistry;
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
  const { message, team, modelRegistry, sessionMessages, mode, onProgress, signal } = opts;
  const maxLayers = opts.maxLayers ?? 3;
  const confidenceThreshold = opts.confidenceThreshold ?? 6;

  const sdk = await getSdk();
  const convertToLlm = (sdk as any).convertToLlm as (msgs: AgentMessage[]) => any[];

  // Build the shared LLM context from existing session messages + the new user message.
  const llmMessages = convertToLlm(sessionMessages);
  llmMessages.push({ role: "user", content: message });

  // --- Phase 1: Fan out to all team members in parallel ---
  onProgress?.({ phase: "fanning-out", layer: 1, progress: 10, message: `Consulting ${team.members.length} models…` });

  let memberResults = await fanOut(
    team.members,
    llmMessages,
    modelRegistry,
    signal,
  );

  onProgress?.({ phase: "aggregating", layer: 1, progress: 50, message: "Synthesizing team responses…" });

  // --- Phase 2: Aggregate ---
  let aggregatorOutput = await aggregate(
    message,
    memberResults,
    team.aggregatorModel,
    modelRegistry,
    llmMessages,
    mode === "advanced",
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
      const lowScorers = memberResults.filter((r) => r.score != null && r.score < confidenceThreshold && r.response);
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
          reQueryMember(r, message, aggregatorOutput.feedback, modelRegistry, signal),
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
        modelRegistry,
        llmMessages,
        true,
        signal,
      );
      scores = aggregatorOutput.scores;
      if (scores) {
        memberResults = memberResults.map((r) => {
          const scoreEntry = scores!.find((s) => s.member === r.modelName || s.member === r.modelId);
          return { ...r, score: scoreEntry?.score };
        });
      }
    }
  }

  const confidence = scores && scores.length > 0
    ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
    : 0;

  onProgress?.({ phase: "done", layer: layers, progress: 100 });

  return {
    briefing: aggregatorOutput.briefing,
    teamResponses: memberResults,
    layers,
    confidence: Math.round(confidence * 10) / 10,
    teamName: team.name,
  };
}

// --- Fan-out ---

async function fanOut(
  members: MoaTeam["members"],
  llmMessages: any[],
  modelRegistry: ModelRegistry,
  signal?: AbortSignal,
): Promise<MoaMemberResult[]> {
  const results = await Promise.allSettled(
    members.map(async (member) => {
      const model = resolveModel(modelRegistry, member.provider, member.modelId);
      if (!model) throw new Error(`Model not found: ${member.provider}/${member.modelId}`);

      const auth = await resolveAuth(modelRegistry, model);
      if (!auth.ok) throw new Error(`No auth for ${member.provider}/${member.modelId}`);

      const context: Context = {
        systemPrompt: memberSystemPrompt(member.role),
        messages: llmMessages,
      };

      const response = await completeSimple(model, context, {
        apiKey: auth.apiKey,
        headers: auth.headers,
        signal,
      });

      return extractText(response);
    }),
  );

  return members.map((member, i) => {
    const result = results[i];
    const modelName = modelRegistry?.find?.(member.provider, member.modelId)?.name ?? member.modelId;
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
      error: result?.status === "rejected" ? String(result.reason?.message ?? result.reason) : "Unknown error",
    };
  });
}

// --- Aggregation ---

interface AggregatorOutput {
  briefing: string;
  scores?: { member: string; score: number; reason: string }[];
  feedback: string;
}

async function aggregate(
  userMessage: string,
  memberResults: MoaMemberResult[],
  aggregatorSpec: { provider: string; modelId: string },
  modelRegistry: ModelRegistry,
  llmMessages: any[],
  advanced: boolean,
  signal?: AbortSignal,
): Promise<AggregatorOutput> {
  const model = resolveModel(modelRegistry, aggregatorSpec.provider, aggregatorSpec.modelId);
  if (!model) throw new Error(`Aggregator model not found: ${aggregatorSpec.provider}/${aggregatorSpec.modelId}`);

  const auth = await resolveAuth(modelRegistry, model);
  if (!auth.ok) throw new Error(`No auth for aggregator ${aggregatorSpec.provider}/${aggregatorSpec.modelId}`);

  // Build the aggregator's context: the user's message + each member's response.
  const teamResponsesText = memberResults
    .filter((r) => r.response)
    .map((r, i) => `--- Team Member ${i + 1}: ${r.modelName}${r.role ? ` (${r.role})` : ""} ---\n${r.response}`)
    .join("\n\n");

  const aggregatorUserMessage = `User's original request:
${userMessage}

Team member responses:
${teamResponsesText}

${advanced ? aggregatorSystemPrompt(true) : aggregatorSystemPrompt(false)}`;

  const context: Context = {
    systemPrompt: "You are an expert aggregator. Synthesize the team's responses into a briefing.",
    messages: [{ role: "user", content: aggregatorUserMessage }],
  };

  const response = await completeSimple(model, context, {
    apiKey: auth.apiKey,
    headers: auth.headers,
    signal,
  });

  const text = extractText(response);

  // Parse scores from advanced mode output.
  let scores: AggregatorOutput["scores"] | undefined;
  let briefing = text;
  let feedback = "";

  if (advanced) {
    const scoresMatch = text.match(/<SCORES>([\s\S]*?)<\/SCORES>/);
    if (scoresMatch) {
      try {
        scores = JSON.parse(scoresMatch[1].trim());
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
  modelRegistry: ModelRegistry,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const model = resolveModel(modelRegistry, member.provider, member.modelId);
  if (!model) return undefined;

  const auth = await resolveAuth(modelRegistry, model);
  if (!auth.ok) return undefined;

  const context: Context = {
    systemPrompt: memberSystemPrompt(member.role),
    messages: [{ role: "user", content: reQueryPrompt(member.modelName, member.response ?? "", feedback, userMessage) }],
  };

  const response = await completeSimple(model, context, {
    apiKey: auth.apiKey,
    headers: auth.headers,
    signal,
  });

  return extractText(response);
}

// --- SDK helpers ---

function resolveModel(modelRegistry: ModelRegistry, provider: string, modelId: string): Model | undefined {
  try {
    return modelRegistry?.find?.(provider, modelId) ?? undefined;
  } catch {
    return undefined;
  }
}

async function resolveAuth(modelRegistry: ModelRegistry, model: Model): Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }> {
  try {
    const auth = await modelRegistry?.getApiKeyAndHeaders?.(model);
    if (!auth?.ok) return { ok: false };
    return { ok: true, apiKey: auth.apiKey, headers: auth.headers };
  } catch {
    return { ok: false };
  }
}

async function completeSimple(model: Model, context: Context, options: any): Promise<AssistantMessage> {
  // Import from the compat entry point (the SDK's standalone streaming API).
  // The path goes through pi-coding-agent's bundled pi-ai dependency.
  const compatPath = "@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/compat";
  const piAi = await import(/* @vite-ignore */ compatPath);
  const complete = (piAi as any).completeSimple ?? (piAi as any).complete;
  if (!complete) throw new Error("completeSimple not found in pi-ai/compat");
  return complete(model, context, options);
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
