import { TaskHost } from "@dynamicagents/core/task";
import { copy } from "@/copy";

/**
 * The claude-container tenant's task host: it owns each A2A task, and
 * `ClaudeContainerWorkflow` (`./workflow.ts`) runs it. The mechanism is core's `/task`.
 */
export class ClaudeContainerHost extends TaskHost<Env> {
  protected readonly copy = copy;
  protected readonly workflowBinding: string = "CLAUDE_CONTAINER_WORKFLOW";
  protected readonly hostBinding: string = "ClaudeContainerHost";
}
