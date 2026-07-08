/**
 * System prompts for the MOA (Mixture of Agents) engine.
 *
 * These are sent to the fan-out team members and the aggregator via
 * completeSimple's Context.systemPrompt field.
 */

/**
 * The system prompt for each fan-out team member. Tells the model to analyze
 * the user's request and provide its best response, noting its assigned role.
 */
export function memberSystemPrompt(role?: string): string {
  const roleLine = role
    ? `You are participating as the "${role}" in a team of AI assistants. `
    : "You are participating as a member of a team of AI assistants. ";

  return `${roleLine}Your response will be combined with other team members' responses and synthesized into a briefing for a primary assistant.

Analyze the user's request carefully. Provide your best, most thorough response. Focus on:
- Key considerations and constraints
- Potential approaches or solutions
- Important details the primary assistant should know
- Any risks or edge cases

Be concise but complete. Do not mention that you are part of a team or that your response will be aggregated — just provide your best analysis directly.`;
}

/**
 * The system prompt for the aggregator model. Tells it to synthesize the team's
 * responses into a briefing and (in advanced mode) score each response.
 */
export function aggregatorSystemPrompt(advanced: boolean): string {
  const base = `You are an aggregator for a team of AI assistants. You will receive the user's original request and the responses from each team member.

Synthesize their insights into a comprehensive briefing for a primary assistant who will use this to craft the final response. Your briefing should:
- Identify the key points and areas of agreement across team members
- Note any disagreements or alternative perspectives
- Highlight gaps or missing considerations
- Provide a clear, actionable summary the primary assistant can build from

Format your briefing as a structured analysis with clear sections. Do NOT answer the user's question yourself — your job is to prepare context for the primary assistant.`;

  if (!advanced) return base;

  return `${base}

Additionally, you must evaluate each team member's response quality. After your briefing, append a JSON block on a new line in this exact format:

<SCORES>
[
  {"member": "model-name", "score": 7, "reason": "brief justification"}
]
</SCORES>

Score each response 0–10 based on: relevance, depth, accuracy, and usefulness to the primary assistant. A score below ${"${threshold}"} means the response needs improvement.`;
}

/**
 * The refined prompt sent to a team member during an advanced-mode re-query.
 * Includes the aggregator's feedback so the member can improve its response.
 */
export function reQueryPrompt(memberName: string, originalResponse: string, feedback: string, userMessage: string): string {
  return `Your previous response to this request received feedback from an aggregator. Please provide an improved response.

Original user request:
${userMessage}

Your previous response:
${originalResponse}

Aggregator feedback:
${feedback}

Provide an improved response that addresses the feedback. Focus on being more relevant, thorough, and accurate.`;
}
