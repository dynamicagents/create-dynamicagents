import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {
  TaskWorkflow,
  type PipelineResult,
  type TaskParams,
  type TaskStep
} from "@dynamicagents/core/workflow";
import { TASK_RECONCILE } from "@/config";

/**
 * `claude-container`'s pipeline: one step, the whole task, on the caller's own
 * `ClaudeContainerAgent`.
 *
 * Whether a task takes a session, and which files it shares, is the agent's to
 * judge within that turn: see `./soul.ts`. A step every task needs, whatever
 * it asks, goes here.
 */
export class ClaudeContainerWorkflow extends TaskWorkflow<Env> {
  /** The step agent's binding. A test worker points it at a scripted one. */
  protected readonly coder: string = "ClaudeContainerAgent";

  override run(event: WorkflowEvent<TaskParams>, step: WorkflowStep) {
    return super.run(event, step);
  }

  protected async pipeline(
    event: WorkflowEvent<TaskParams>,
    step: TaskStep
  ): Promise<PipelineResult> {
    const reply = await step.agent("main", {
      agent: this.coder,
      input: event.payload.text,
      joins: true,
      reconcile: TASK_RECONCILE
    });
    return { reply };
  }
}
