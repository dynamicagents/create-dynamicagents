import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import { assigned } from "../text";
import source from "./worker.ts.tpl";

/**
 * `test/worker.ts` — the Worker the suite runs.
 *
 * Workers AI has no local execution mode, so the agent's real `getModel()`
 * cannot finish a turn in a test. Each `Test*` class in `./worker.ts.tpl` is
 * the real class with only its model swapped, behind the real host and the real
 * pipeline pointed at it, so a spec drives the agent's actual plugins, soul,
 * card and lifecycle through core's A2A edge.
 *
 * The most structural of the templates, and the one that most needed to become
 * a file: six regions, all on `subAgent`, from a named import inside a list to
 * a whole class and the script rule that reaches it.
 */
export function testWorkerTs(spec: AgentSpec, n: AgentNames): string {
  const T = `Test${n.pascal}`;

  return render(source, {
    when: { subAgent: spec.subAgent },
    tokens: {
      TENANT: spec.tenant,
      AGENT_CLASS: n.agentClass,
      HOST_CLASS: n.hostClass,
      WORKFLOW_CLASS: n.workflowClass,
      CHILD_CLASS: n.childClass,
      TEST_AGENT_CLASS: `${T}Agent`,
      TEST_HOST_CLASS: `${T}Host`,
      TEST_WORKFLOW_CLASS: `${T}Workflow`,
      TEST_CHILD_CLASS: `${T}Child`,
      // A token each rather than `TEST_$SCREAMING_HOST`, which the
      // longest-run match would read as the single token `$SCREAMING_HOST`.
      TEST_HOST_BINDING: `TEST_${n.screaming}_HOST`,
      TEST_AGENT_BINDING: `TEST_${n.screaming}_AGENT`,
      TEST_WORKFLOW_BINDING: `TEST_${n.workflowBinding}`,
      SUBAGENT_NOTE: spec.subAgent ? " — and its sub-agent's —" : "",
      // The overrides that break after the `=` past the print width.
      HOST_BINDINGS: [
        assigned(
          "protected override readonly workflowBinding",
          `TEST_${n.workflowBinding}`
        ),
        assigned(
          "protected override readonly hostBinding",
          `TEST_${n.screaming}_HOST`
        )
      ].join("\n"),
      STEP_AGENT: assigned(
        `protected override readonly ${n.camel}`,
        `TEST_${n.screaming}_AGENT`
      )
    }
  });
}
