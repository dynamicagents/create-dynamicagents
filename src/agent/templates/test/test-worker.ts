import type { AgentNames, AgentSpec } from "../../spec.js";
import { assigned, namedFrom } from "../text.js";

/**
 * `test/worker.ts` — the Worker the suite runs.
 *
 * Workers AI has no local execution mode, so the agent's real `getModel()`
 * cannot finish a turn in a test. Each `Test*` class below is the real class
 * with only its model swapped, behind the real host and the real pipeline
 * pointed at it, so a spec drives the agent's actual plugins, soul, card and
 * lifecycle through core's A2A edge.
 */
export function testWorkerTs(spec: AgentSpec, n: AgentNames): string {
  const T = `Test${n.pascal}`;

  const hostBindings = [
    assigned(
      "protected override readonly workflowBinding",
      `TEST_${n.workflowBinding}`
    ),
    assigned(
      "protected override readonly hostBinding",
      `TEST_${n.screaming}_HOST`
    )
  ].join("\n");
  const stepAgent = assigned(
    `protected override readonly ${n.camel}`,
    `TEST_${n.screaming}_AGENT`
  );

  const childClass = spec.subAgent
    ? `
/** The sub-agent, answering from a script of its own. */
export class ${T}Child extends ${n.childClass} {
  static override spec = ${n.childClass}.spec;

  override getModel(): ThinkModel {
    return scriptedModel((view) => ({
      text: \`child did: \${view.lastUserText}\`
    }));
  }
}
`
    : "";

  const subAgentImports = spec.subAgent
    ? `import type { SubAgentClass } from "@dynamicagents/core/subagent";\n`
    : "";
  const at = (name: string, module: string): string =>
    namedFrom("import", [name], `@/agents/${spec.tenant}/${module}`);
  const childImport = spec.subAgent ? `${at(n.childClass, "children")}\n` : "";
  const subAgentOverride = spec.subAgent
    ? `
  override getSubAgents(): SubAgentClass[] {
    return [${T}Child];
  }
`
    : "";

  const delegateRule = spec.subAgent
    ? `
  // \`delegate:<task>\` hands the task to the sub-agent and then answers with
  // what it reported, which is what proves the result came back.
  const delegate = after(text, "delegate:");
  if (delegate !== undefined) {
    return view.answered
      ? { text: lastToolOutput(view) }
      : call("general", { task: delegate }, "Delegating.");
  }
`
    : "";

  const toolOutput = spec.subAgent
    ? `
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
`
    : "";

  const imports = [
    ...(spec.subAgent ? ["  call,"] : []),
    "  scriptedModel,",
    "  type MockStep,",
    "  type ModelTurnView"
  ].join("\n");

  return `import type { ThinkModel } from "@cloudflare/think";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { handleArtifactRoute } from "@dynamicagents/core/artifacts";
${subAgentImports}import {
${imports}
} from "@dynamicagents/core/testing";
import { createA2AWorker, defineAgent } from "@dynamicagents/core/worker";
import type { TaskParams } from "@dynamicagents/core/workflow";
import { RETRY_BRIEF } from "@/copy";
import { hostManifest } from "@/host-manifest";
${at(n.agentClass, "agent")}
${childImport}${at(n.hostClass, "host")}
${at("manifest", "manifest")}
${at(n.workflowClass, "workflow")}

/**
 * The Worker the suite runs: this project's own, plus the agent on a scripted
 * model.
 *
 * Workers AI has no local execution mode, so the real \`getModel()\` cannot
 * finish a turn here. Each \`Test*\` class below is the real one with only its
 * model swapped${spec.subAgent ? " — and its sub-agent's —" : ""}, behind the real host and the real pipeline
 * pointed at it, so a spec drives the agent's actual plugins, soul, card and
 * lifecycle through core's A2A edge. They are bound for tests only, in
 * \`vitest.config.ts\`.
 *
 * Every production class is re-exported, because the runtime resolves a Durable
 * Object by class name and the pool loads this module in place of
 * \`src/index.ts\`.
 */

export * from "@/index";

export interface TestEnv extends Env {
  TEST_${n.screaming}_HOST: DurableObjectNamespace<${T}Host>;
  TEST_${n.screaming}_AGENT: DurableObjectNamespace<${T}Agent>;
  TEST_${n.workflowBinding}: Workflow<TaskParams>;
}

/** \`prefix:rest\` → \`rest\`. */
function after(text: string, prefix: string): string | undefined {
  return text.startsWith(prefix) ? text.slice(prefix.length) : undefined;
}
${toolOutput}
/**
 * The agent's script, keyed on the message that started the turn rather than on
 * a queue: a retry, a follow-up turn and a recovered one all consume steps, and
 * which call comes next is not something a spec controls.
 *
 * A retry arrives with \`RETRY_BRIEF\` in front of the original text, which is
 * how \`flaky\` tells its second attempt from its first.
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
${delegateRule}
  return { text: after(text, "echo:") ?? text };
}

export class ${T}Agent extends ${n.agentClass} {
  override getModel(): ThinkModel {
    return scriptedModel(script);
  }
${subAgentOverride}}
${childClass}
/** The real host, pointed at the scripted pipeline. */
export class ${T}Host extends ${n.hostClass} {
${hostBindings}
}

/**
 * The real pipeline, on the scripted agent. It declares \`run()\`, as every
 * pipeline must.
 */
export class ${T}Workflow extends ${n.workflowClass} {
${stepAgent}
  override run(event: WorkflowEvent<TaskParams>, step: WorkflowStep) {
    return super.run(event, step);
  }
}

const a2a = createA2AWorker<TestEnv>({
  manifest: hostManifest,
  agents: [
    defineAgent({
      tenant: "${spec.tenant}",
      manifest,
      agent: (env: TestEnv) => env.TEST_${n.screaming}_HOST
    })
  ]
});

export default {
  async fetch(request: Request, env: TestEnv): Promise<Response> {
    return (await handleArtifactRoute(request, env)) ?? a2a(request, env);
  }
} satisfies ExportedHandler<TestEnv>;
`;
}
