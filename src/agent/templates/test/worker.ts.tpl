import type { ThinkModel } from "@cloudflare/think";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { handleArtifactRoute } from "@dynamicagents/core/artifacts";
// $when subAgent
import type { SubAgentClass } from "@dynamicagents/core/subagent";
// $end
import {
  // $when subAgent
  call,
  // $end
  scriptedModel,
  type MockStep,
  type ModelTurnView
} from "@dynamicagents/core/testing";
import { createA2AWorker, defineAgent } from "@dynamicagents/core/worker";
import type { TaskParams } from "@dynamicagents/core/workflow";
import { RETRY_BRIEF } from "@/copy";
import { hostManifest } from "@/host-manifest";
import { $AGENT_CLASS } from "@/agents/$TENANT/agent";
// $when subAgent
import { $CHILD_CLASS } from "@/agents/$TENANT/children";
// $end
import { $HOST_CLASS } from "@/agents/$TENANT/host";
import { manifest } from "@/agents/$TENANT/manifest";
import { $WORKFLOW_CLASS } from "@/agents/$TENANT/workflow";

/**
 * The Worker the suite runs: this project's own, plus the agent on a scripted
 * model.
 *
 * Workers AI has no local execution mode, so the real `getModel()` cannot
 * finish a turn here. Each `Test*` class below is the real one with only its
 * model swapped$SUBAGENT_NOTE, behind the real host and the real pipeline
 * pointed at it, so a spec drives the agent's actual plugins, soul, card and
 * lifecycle through core's A2A edge. They are bound for tests only, in
 * `vitest.config.ts`.
 *
 * Every production class is re-exported, because the runtime resolves a Durable
 * Object by class name and the pool loads this module in place of
 * `src/index.ts`.
 */

export * from "@/index";

export interface TestEnv extends Env {
  $TEST_HOST_BINDING: DurableObjectNamespace<$TEST_HOST_CLASS>;
  $TEST_AGENT_BINDING: DurableObjectNamespace<$TEST_AGENT_CLASS>;
  $TEST_WORKFLOW_BINDING: Workflow<TaskParams>;
}

/** `prefix:rest` → `rest`. */
function after(text: string, prefix: string): string | undefined {
  return text.startsWith(prefix) ? text.slice(prefix.length) : undefined;
}

// $when subAgent
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

// $end
/**
 * The agent's script, keyed on the message that started the turn rather than on
 * a queue: a retry, a follow-up turn and a recovered one all consume steps, and
 * which call comes next is not something a spec controls.
 *
 * A retry arrives with `RETRY_BRIEF` in front of the original text, which is
 * how `flaky` tells its second attempt from its first.
 */
function script(view: ModelTurnView): MockStep {
  const retry = view.lastUserText.startsWith(RETRY_BRIEF);
  const text = retry
    ? view.lastUserText.slice(RETRY_BRIEF.length).trimStart()
    : view.lastUserText;

  // Fails every attempt, so the task settles failed in this project's words.
  if (text === "boom") return { error: "told to fail" };
  // Fails the first attempt only: the retry's brief is what recovers it.
  if (text === "flaky") {
    return retry ? { text: "recovered" } : { error: "told to fail once" };
  }

  // $when subAgent
  // `delegate:<task>` hands the task to the sub-agent and then answers with
  // what it reported, which is what proves the result came back.
  const delegate = after(text, "delegate:");
  if (delegate !== undefined) {
    return view.answered
      ? { text: lastToolOutput(view) }
      : call("general", { task: delegate }, "Delegating.");
  }

  // $end
  return { text: after(text, "echo:") ?? text };
}

export class $TEST_AGENT_CLASS extends $AGENT_CLASS {
  override getModel(): ThinkModel {
    return scriptedModel(script);
  }
  // $when subAgent

  override getSubAgents(): SubAgentClass[] {
    return [$TEST_CHILD_CLASS];
  }
  // $end
}

// $when subAgent
/** The sub-agent, answering from a script of its own. */
export class $TEST_CHILD_CLASS extends $CHILD_CLASS {
  static override spec = $CHILD_CLASS.spec;

  override getModel(): ThinkModel {
    return scriptedModel((view) => ({
      text: `child did: ${view.lastUserText}`
    }));
  }
}

// $end
/** The real host, pointed at the scripted pipeline. */
export class $TEST_HOST_CLASS extends $HOST_CLASS {
  // $block HOST_BINDINGS
}

/**
 * The real pipeline, on the scripted agent. It declares `run()`, as every
 * pipeline must.
 */
export class $TEST_WORKFLOW_CLASS extends $WORKFLOW_CLASS {
  // $block STEP_AGENT
  override run(event: WorkflowEvent<TaskParams>, step: WorkflowStep) {
    return super.run(event, step);
  }
}

const a2a = createA2AWorker<TestEnv>({
  manifest: hostManifest,
  agents: [
    defineAgent({
      tenant: "$TENANT",
      manifest,
      agent: (env: TestEnv) => env.$TEST_HOST_BINDING
    })
  ]
});

export default {
  async fetch(request: Request, env: TestEnv): Promise<Response> {
    return (await handleArtifactRoute(request, env)) ?? a2a(request, env);
  }
} satisfies ExportedHandler<TestEnv>;
