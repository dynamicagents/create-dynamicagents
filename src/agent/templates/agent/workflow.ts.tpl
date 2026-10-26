import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {
  TaskWorkflow,
  type PipelineResult,
  type TaskParams,
  type TaskStep
} from "@dynamicagents/core/workflow";
import { TUNING } from "./tuning";

/**
 * This tenant's pipeline: one step, the whole task, on the caller's own
 * `$AGENT_CLASS`. A step before it or after it — a triage, a judge, a
 * second opinion — goes here, and each gets its own `step.agent(...)` call.
 *
 * The step agent is named by its **binding**, never imported: a pipeline that
 * imported the class would pull that agent's whole module graph — plugins
 * included — into every bundle this pipeline is part of. Typed `: string` so a
 * test can point it at a scripted agent.
 *
 * `run()` is declared here, as every pipeline must declare it: the runtime
 * resolves the entrypoint on this class, not on its base.
 */
export class $WORKFLOW_CLASS extends TaskWorkflow<Env> {
  // $block STEP_AGENT

  override run(event: WorkflowEvent<TaskParams>, step: WorkflowStep) {
    return super.run(event, step);
  }

  protected async pipeline(
    event: WorkflowEvent<TaskParams>,
    step: TaskStep
  ): Promise<PipelineResult> {
    const reply = await step.agent("main", {
      agent: this.$CAMEL,
      input: event.payload.text,
      reconcile: TUNING.reconcile
    });
    return { reply };
  }
}
