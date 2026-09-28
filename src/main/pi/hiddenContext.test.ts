/**
 * Regression guard for how Pi Desktop injects hidden context.
 *
 * Pi Routing (runMoaEnrichment) and the web-search nudge (injectWebNudge) both
 * append a hidden custom message straight to the session's SessionManager and
 * rely on the SDK including it in the NEXT model request. On SDK 0.86.0 it did
 * not: the entry was saved to the session file but left out of the request,
 * so the team's briefing never reached the main model on the turn it was
 * produced for — and nothing errored. SDK 0.87 made the SessionManager the
 * canonical source of request context, which fixed it.
 *
 * This drives the real SDK end to end — real session, real prompt() — with the
 * agent's stream function stubbed to capture the exact context handed to the
 * provider. No network request is made. If a future SDK upgrade stops sending
 * appended messages, this fails instead of Pi Routing silently going inert.
 */
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const MARKER = "PI-ROUTING-BRIEFING-MARKER";

let tmp: string | undefined;

afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

/** Build a real SDK session in an isolated agentDir so the test never touches ~/.pi. */
async function createProbeSession() {
  const pi: any = await import("@earendil-works/pi-coding-agent");
  tmp = mkdtempSync(join(tmpdir(), "pi-desktop-hidden-context-"));
  const agentDir = join(tmp, "agent");
  const cwd = join(tmp, "cwd");
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  const services = await pi.createAgentSessionServices({ cwd, agentDir });
  // A fake in-memory key lets model selection pass. It is never sent: the
  // stream function is replaced below before any request can go out.
  await services.modelRuntime.setRuntimeApiKey("anthropic", "sk-ant-test-not-real");
  const available = await services.modelRuntime.getAvailable();
  const model = available.find((m: any) => m.provider === "anthropic") ?? available[0];
  if (!model) throw new Error("SDK exposed no model to select");

  const { session } = await pi.createAgentSessionFromServices({
    services,
    sessionManager: pi.SessionManager.inMemory(cwd),
  });
  await session.setModel(model);

  let captured: any = null;
  session.agent.streamFunction = (_model: unknown, context: unknown) => {
    captured = context;
    throw new Error("test: request captured, not sending");
  };

  return { session, request: () => JSON.stringify(captured?.messages ?? captured ?? null) };
}

describe("hidden context injection", () => {
  it(
    "a message appended to the SessionManager reaches the next model request",
    async () => {
      const { session, request } = await createProbeSession();

      // Exactly how runMoaEnrichment injects the Pi Routing briefing.
      session.sessionManager.appendCustomMessageEntry(
        "moa-briefing",
        `[Pi Routing Briefing — Team: Test]\n\n${MARKER}`,
        false,
        { team: "Test" },
      );

      await session.prompt("What should I do?");
      session.dispose?.();

      const sent = request();
      expect(sent, "no request reached the stubbed provider").not.toBe("null");
      expect(sent).toContain("What should I do?");
      expect(sent, "the Pi Routing briefing was left out of the model request").toContain(MARKER);
    },
    60_000,
  );
});
