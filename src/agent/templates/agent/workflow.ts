import type { AgentNames } from "../../spec.js";
import { assigned } from "../text.js";

/** `<dir>/workflow.ts` — core's `TaskWorkflow`: the task as steps. */
export const workflowTs = (n: AgentNames): string => {
  const stepAgent = assigned(
    `protected readonly ${n.camel}: string`,
    n.agentClass
  );

  return `import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {
  TaskWorkflow,
  type PipelineResult,
  type TaskParams,
  type TaskStep
} from "@dynamicagents/core/workflow";

/**
 * This tenant's pipeline: one step, the whole task, on the caller's own
 * \`${n.agentClass}\`. A step before it or after it — a triage, a judge, a
 * second opinion — goes here, and each gets its own \`step.agent(...)\` call.
 *
 * The step agent is named by its **binding**, never imported: a pipeline that
 * imported the class would pull that agent's whole module graph — plugins
 * included — into every bundle this pipeline is part of. Typed \`: string\` so a
 * test can point it at a scripted agent.
 *
 * \`run()\` is declared here, as every pipeline must declare it: the runtime
 * resolves the entrypoint on this class, not on its base.
 */
export class ${n.workflowClass} extends TaskWorkflow<Env> {
${stepAgent}

  override run(event: WorkflowEvent<TaskParams>, step: WorkflowStep) {
    return super.run(event, step);
  }

  protected async pipeline(
    event: WorkflowEvent<TaskParams>,
    step: TaskStep
  ): Promise<PipelineResult> {
    const reply = await step.agent("main", {
      agent: this.${n.camel},
      input: event.payload.text
    });
    return { reply };
  }
}
`;
};
