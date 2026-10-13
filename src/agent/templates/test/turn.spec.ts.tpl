import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import {
  createAgentHarness,
  TERMINAL_CALLBACK_STATES,
  type AgentHarness
} from "@dynamicagents/core/testing";
import { copy } from "@/copy";
import worker, { type TestEnv } from "./worker";

/**
 * `$TENANT`'s A2A lifecycle, driven end to end through core's edge, its host
 * and its pipeline on a scripted model: every scenario goes in as a
 * gatekeeper-signed `SendMessage` and comes out as push callbacks.
 *
 * Core's own suite holds the lifecycle itself. What is checked here is that
 * **this** agent is wired into it: its host runs its pipeline on it, its soul
 * and plugins load, its retry is briefed$SUBAGENT_NOTE, and its words are the ones a
 * caller reads when something goes wrong.
 *
 * **One caller per spec.** An object runs its turns one at a time, so two specs
 * sharing a caller would serialize and see each other's callbacks.
 */

const testEnv = env as unknown as TestEnv;

function harnessFor(label: string): AgentHarness {
  return createAgentHarness({
    worker,
    env: testEnv,
    tenant: "$TENANT",
    identity: {
      key: `$TENANT:${label}:${crypto.randomUUID()}`,
      name: "Spec Caller",
      kind: "custom",
      workspaceId: 1
    }
  });
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("$TENANT", () => {
  it("answers a turn and calls back exactly once", async () => {
    const harness = harnessFor("turn");
    using _ = harness.interceptGatekeeper();

    const accepted = await harness.send("echo:hello there");
    const done = await harness.waitForTerminal(accepted.id);
    expect(done.state).toBe("TASK_STATE_COMPLETED");
    expect(done.text).toBe("hello there");

    await pause(300);
    const terminals = harness.callbacks.filter(
      (c) => c.taskId === accepted.id && TERMINAL_CALLBACK_STATES.has(c.state)
    );
    expect(terminals).toHaveLength(1);
  });

  it("runs a failed step once more, briefed as a retry", async () => {
    const harness = harnessFor("flaky");
    using _ = harness.interceptGatekeeper();

    const accepted = await harness.send("flaky");
    const done = await harness.waitForTerminal(accepted.id);
    expect(done.state).toBe("TASK_STATE_COMPLETED");
    // What `RETRY_BRIEF` (src/copy.ts) bought: the second attempt knows it is
    // one, and carries on rather than starting again.
    expect(done.text).toBe("recovered");
  });

  it("fails a turn that errors every time, in this project's words", async () => {
    const harness = harnessFor("boom");
    using _ = harness.interceptGatekeeper();

    const accepted = await harness.send("boom");
    const failed = await harness.waitForTerminal(accepted.id);
    expect(failed.state).toBe("TASK_STATE_FAILED");
    // The agent's words, from src/copy.ts — core ships none.
    expect(failed.text).toBe(copy.failed);
  });
  // $when subAgent

  it("hands a self-contained task to its sub-agent and composes the result", async () => {
    const harness = harnessFor("delegate");
    using _ = harness.interceptGatekeeper();

    const accepted = await harness.send("delegate:summarize the handbook");
    const done = await harness.waitForTerminal(accepted.id);
    expect(done.state).toBe("TASK_STATE_COMPLETED");
    expect(done.text).toContain("child did: summarize the handbook");
  });
  // $end
});
