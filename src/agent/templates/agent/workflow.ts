import type { AgentNames } from "../../spec";
import { render } from "../render";
import { assigned } from "../text";
import source from "./workflow.ts.tpl";

/** `<dir>/workflow.ts` — core's `TaskWorkflow`: the task as steps. */
export const workflowTs = (n: AgentNames): string =>
  render(source, {
    tokens: {
      WORKFLOW_CLASS: n.workflowClass,
      AGENT_CLASS: n.agentClass,
      CAMEL: n.camel,
      // Breaks after the `=` past the print width, and the field's own name is
      // derived too, so the whole line is laid out here.
      STEP_AGENT: assigned(
        `protected readonly ${n.camel}: string`,
        n.agentClass
      )
    }
  });
