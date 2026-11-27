import type { ThinkModel } from "@cloudflare/think";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { SubAgentSpec } from "@dynamicagents/core";
import { handleArtifactRoute } from "@dynamicagents/core/artifacts";
import type { SubAgentClass } from "@dynamicagents/core/subagent";
import type { TaskParams } from "@dynamicagents/core/workflow";
import {
  call,
  scriptedModel,
  type MockStep,
  type ModelTurnView
} from "@dynamicagents/core/testing";
import { createA2AWorker, defineAgent } from "@dynamicagents/core/worker";
import { SANDBOX_RUNTIME_KEY } from "@dynamicagents/plugins/sandbox";
import { RETRY_BRIEF } from "@/copy";
import { hostManifest } from "@/host-manifest";
import { ClaudeContainerAgent } from "@/agents/claude-container/agent";
import { ClaudeContainerSessionChild } from "@/agents/claude-container/children";
import { ClaudeContainerHost } from "@/agents/claude-container/host";
import { manifest as claudeContainerManifest } from "@/agents/claude-container/manifest";
import { ClaudeContainerWorkflow } from "@/agents/claude-container/workflow";
import { ClaudeContainerSandbox as LiveClaudeContainerSandbox } from "@/agents/claude-container/sandbox";

/**
 * The Worker the suite runs: this deployment's own, plus the agent on a
 * scripted model.
 *
 * Workers AI has no local mode, so an agent's real `getModel()` cannot finish a
 * turn here. Each `Test*` class below is the real agent with only its model
 * swapped — and its sub-agents' — behind its tenant's real host and pipeline,
 * pointed at it, so a spec drives the agent's actual plugins, souls and
 * lifecycle through core's A2A edge. The classes are bound for tests only, in
 * `vitest.config.ts`.
 */

export * from "@/index";
// Named, not left to the line above: the pool's `ctx.exports` lists what this
// module exports by name, and a sandbox's harness refuses to start without its
// egress entrypoint there.
export { ClaudeContainerEgress, DirectoryBackupGateway } from "@/index";

/**
 * A container that is stopped and stays stopped: the pool builds the image but
 * starts no container from it, so a spec that reaches one has reached past
 * what it tests. What the sandbox does
 * with a running container is `@dynamicagents/plugins/sandbox`'s to test, over
 * its own fake; here a sandbox answers what it answers from its storage: its
 * records, its credential pool, its sessions.
 */
function stoppedContainer(): Container {
  const refuse = async () => {
    throw new Error("the test pool starts no container");
  };
  return {
    running: false,
    images: { app: "test-image" },
    start: () => {
      throw new Error("the test pool runs no container");
    },
    monitor: () => new Promise<void>(() => undefined),
    destroy: async () => undefined,
    signal: () => undefined,
    getTcpPort: () => {
      throw new Error("the test pool runs no container");
    },
    setInactivityTimeout: async () => undefined,
    interceptOutboundHttp: async () => undefined,
    interceptAllOutboundHttp: async () => undefined,
    interceptOutboundHttps: async () => undefined,
    snapshotContainer: refuse,
    exec: refuse,
    inspect: async () => null
  } as unknown as Container;
}

/** The sandbox, bound under its own name, over {@link stoppedContainer}. */
export class ClaudeContainerSandbox extends LiveClaudeContainerSandbox {
  protected override containerFor(): Container {
    return stoppedContainer();
  }
}

export interface TestEnv extends Env {
  TEST_CLAUDE_CONTAINER_AGENT: DurableObjectNamespace<TestClaudeContainerAgent>;
  TEST_CLAUDE_CONTAINER_HOST: DurableObjectNamespace<TestClaudeContainerHost>;
  TEST_CLAUDE_CONTAINER_WORKFLOW: Workflow<TaskParams>;
}

function after(text: string, prefix: string): string | undefined {
  return text.startsWith(prefix) ? text.slice(prefix.length) : undefined;
}

/** The text of the most recent tool result, as the model was shown it. */
function lastToolOutput(view: ModelTurnView): string {
  for (let i = view.prompt.length - 1; i >= 0; i--) {
    const message = view.prompt[i]!;
    if (message.role !== "tool") continue;
    const part = message.content.find((p) => p.type === "tool-result") as
      { output?: { value: unknown } } | undefined;
    const value = part?.output?.value;
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return "";
}

/** `text` less each of `briefs` that leads it, in order. */
function unbrief(text: string, briefs: readonly string[]): string {
  let rest = text;
  for (const brief of briefs) {
    if (rest.startsWith(brief)) rest = rest.slice(brief.length).trimStart();
  }
  return rest;
}

/**
 * A parent's script, keyed on the message that started the turn, less the
 * retry's brief. `delegate:` hands the rest to a session; anything else is
 * echoed, which is how a follow-up turn answers: a finished background run
 * arrives as an ordinary user message.
 */
function parentRule(subAgentTool: string) {
  return (view: ModelTurnView): MockStep => {
    const text = unbrief(view.lastUserText, [RETRY_BRIEF]);
    const delegate = after(text, "delegate:");
    if (delegate !== undefined) {
      return view.answered
        ? { text: lastToolOutput(view) }
        : call(subAgentTool, { task: delegate }, "Delegating.");
    }
    return { text: after(text, "echo:") ?? text };
  };
}

/** A session's script: it reports what it was asked to do. */
function childRule(view: ModelTurnView): MockStep {
  return { text: `child did: ${view.lastUserText}` };
}

// --- claude-container -------------------------------------------------------

/**
 * The session's spec with a scratchpad nobody has to open: the real `prepare`
 * needs a scratchpad in a container, which the suite never starts. It answers
 * in the real one's shape, under the key the session's `getModel` reads, so a
 * spec that reaches the real model finds a sandbox named.
 */
const SESSION_SPEC = {
  ...ClaudeContainerSessionChild.spec,
  prepare: async () => ({
    [SANDBOX_RUNTIME_KEY]: "test-sandbox",
    dir: "/workspace/scratch"
  })
} as SubAgentSpec<never, never>;

export class TestClaudeContainerSessionChild extends ClaudeContainerSessionChild {
  static override spec = SESSION_SPEC;
  override getModel(): ThinkModel {
    return scriptedModel(childRule);
  }
}

/** The real agent on a scripted model. `delegate:` starts a session. */
export class TestClaudeContainerAgent extends ClaudeContainerAgent {
  override getModel(): ThinkModel {
    return scriptedModel(parentRule("claude_code"));
  }
  override getSubAgents(): SubAgentClass[] {
    return [TestClaudeContainerSessionChild];
  }
}

/** `claude-container`'s host, pointed at the scripted pipeline. */
export class TestClaudeContainerHost extends ClaudeContainerHost {
  protected override readonly workflowBinding =
    "TEST_CLAUDE_CONTAINER_WORKFLOW";
  protected override readonly hostBinding = "TEST_CLAUDE_CONTAINER_HOST";
}

/** `claude-container`'s pipeline, on the scripted agent. */
export class TestClaudeContainerWorkflow extends ClaudeContainerWorkflow {
  protected override readonly coder = "TEST_CLAUDE_CONTAINER_AGENT";
  override run(event: WorkflowEvent<TaskParams>, step: WorkflowStep) {
    return super.run(event, step);
  }
}

// --- the Worker ---------------------------------------------------------------

const a2a = createA2AWorker<TestEnv>({
  manifest: hostManifest,
  agents: [
    defineAgent({
      tenant: "claude-container",
      manifest: claudeContainerManifest,
      agent: (env: TestEnv) => env.TEST_CLAUDE_CONTAINER_HOST
    })
  ]
});

export default {
  async fetch(request: Request, env: TestEnv): Promise<Response> {
    return (await handleArtifactRoute(request, env)) ?? a2a(request, env);
  }
} satisfies ExportedHandler<TestEnv>;
