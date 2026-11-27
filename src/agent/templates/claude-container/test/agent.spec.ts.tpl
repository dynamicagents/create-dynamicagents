import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import type { SubAgentPrepareContext } from "@dynamicagents/core";
import { createAgentHarness } from "@dynamicagents/core/testing";
import { requireArtifactsStub } from "@dynamicagents/core/artifacts";
import { sandboxNameFromRuntime } from "@dynamicagents/plugins/sandbox";
import {
  ClaudeContainerSessionChild,
  scratchSandbox
} from "@/agents/claude-container/children";
import { shareFileTool } from "@/agents/claude-container/share";
import { SCRATCH_DIR } from "@/workspace/scratch";
import worker, { type TestEnv } from "./worker";

/**
 * `claude-container` through the real host and workflow, on a scripted agent and
 * a scripted session: `delegate:` starts a session, whose report the agent
 * finishes on. And the parts this agent adds to a Claude Code session: where
 * it is refused, and how a file it made reaches the person.
 */

const testEnv = env as unknown as TestEnv;

function harnessFor(label: string) {
  return createAgentHarness({
    worker,
    env: testEnv,
    tenant: "claude-container",
    identity: {
      key: `claude-container:${label}:${crypto.randomUUID()}`,
      name: "Spec Caller",
      kind: "custom",
      workspaceId: 1
    }
  });
}

describe("a task", () => {
  it("is handed to a session, and finishes on its report", async () => {
    const harness = harnessFor("delegate");
    using _ = harness.interceptGatekeeper();
    const task = await harness.send("delegate:make the file");
    const done = await harness.waitForTerminal(task.id);
    expect(done.state).toBe("TASK_STATE_COMPLETED");
    expect(done.text).toContain("child did: make the file");
  });

  it("is answered by the agent itself when nothing needs running", async () => {
    const harness = harnessFor("echo");
    using _ = harness.interceptGatekeeper();
    const task = await harness.send("echo:nothing to run");
    const done = await harness.waitForTerminal(task.id);
    expect(done.state).toBe("TASK_STATE_COMPLETED");
    expect(done.text).toBe("nothing to run");
  });
});

describe("a session", () => {
  /** The real `prepare`, as the parent's `claude_code` call runs it. */
  const prepare = (caller: string) =>
    (
      ClaudeContainerSessionChild.spec.prepare as unknown as (
        ctx: SubAgentPrepareContext<unknown, Env>
      ) => Promise<Record<string, unknown>>
    )({
      input: { task: "anything" },
      parent: { env: testEnv, callerKey: () => caller }
    } as unknown as SubAgentPrepareContext<unknown, Env>);

  it("is refused before it starts when no scratchpad is open", async () => {
    await expect(
      prepare(`claude-container:refused:${crypto.randomUUID()}`)
    ).rejects.toThrow(/scratch_open/);
  });

  it("is handed the caller's sandbox under the key its model reads", async () => {
    // What `scratch_open` records once the scratchpad exists. The record is the
    // sandbox's storage, so it holds over a container that stays stopped, and
    // the real `prepare` gets past its refusal. The test session's own
    // `prepare` stands in for this one, so this is where its answer is pinned.
    const caller = `claude-container:prepared:${crypto.randomUUID()}`;
    const name = scratchSandbox(caller);
    await testEnv.CLAUDE_CONTAINER_SANDBOX.getByName(name).noteCheckout({
      dir: SCRATCH_DIR,
      kind: "scratch"
    });
    const runtime = await prepare(caller);
    expect(sandboxNameFromRuntime(runtime)).toBe(name);
    expect(runtime.dir).toBe(SCRATCH_DIR);
  });
});

describe("share_file", () => {
  type Exec = Parameters<typeof shareFileTool>[0]["exec"];

  /** What `base64 -w 0` prints for these bytes. */
  const base64 = (bytes: Uint8Array): string => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };

  /**
   * A sandbox whose file holds `content`, as the real exec answers the read:
   * the bytes in base64. A string is the UTF-8 a file of that text holds.
   */
  const execAnswering =
    (content: string | Uint8Array, success = true): Exec =>
    async () => ({
      success,
      stdout: base64(
        typeof content === "string"
          ? new TextEncoder().encode(content)
          : content
      ),
      stderr: "",
      exitCode: success ? 0 : 1
    });

  const share = (exec: Exec, path: string) =>
    shareFileTool({
      exec,
      env: testEnv,
      owner: () => "claude-container:share",
      origin: () => "https://agent.example"
    }).execute!({ path }, {
      toolCallId: "t",
      messages: []
    } as unknown as Parameters<
      NonNullable<ReturnType<typeof shareFileTool>["execute"]>
    >[1]) as Promise<string>;

  it("files a text file as a page, and answers its link", async () => {
    const answer = await share(execAnswering("a,b\n1,2\n"), "out/data.csv");
    const link = /https:\/\/agent\.example\/a\/([\w-]+)/.exec(answer);
    expect(link, answer).not.toBeNull();
    const page = await requireArtifactsStub(testEnv).readArtifact(link![1]!);
    expect(page?.entries.at(-1)?.text).toBe("a,b\n1,2\n");
    expect(page?.entries.at(-1)?.label).toBe("out/data.csv");
  });

  it("measures the limit in bytes, so multibyte text past it says it was cut", async () => {
    const limit = 256 * 1024;
    // Two bytes a character, then one more byte: what `head -c` reads of a
    // longer file, one past the limit in bytes and half of it in units.
    const over = "é".repeat(limit / 2) + "a";
    const answer = await share(execAnswering(over), "out/notes.txt");
    expect(answer).toContain("cut at 256 KB");
    const link = /https:\/\/agent\.example\/a\/([\w-]+)/.exec(answer);
    const page = await requireArtifactsStub(testEnv).readArtifact(link![1]!);
    const text = page?.entries.at(-1)?.text ?? "";
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(limit);
    expect(text).not.toContain("\uFFFD");
  });

  it("shares multibyte text at the limit whole", async () => {
    const atLimit = "é".repeat((256 * 1024) / 2);
    const answer = await share(execAnswering(atLimit), "out/notes.txt");
    expect(answer).not.toContain("cut at");
  });

  it("refuses text that is not UTF-8 rather than share it mangled", async () => {
    // Latin-1 `café`: the `é` is one byte that UTF-8 cannot read.
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x0a]);
    expect(await share(execAnswering(latin1), "out/notes.txt")).toMatch(
      /not UTF-8 text/
    );
  });

  it("refuses a binary file", async () => {
    expect(await share(execAnswering("PK\u0000\u0003"), "out.zip")).toMatch(
      /not a text file/
    );
  });

  it("says what went wrong when the file cannot be read", async () => {
    expect(await share(execAnswering("", false), "missing.txt")).toMatch(
      /Could not read `missing.txt`/
    );
  });
});
