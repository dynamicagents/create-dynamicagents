import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./vitest.config.ts.tpl";

/** `vitest.config.ts` — one pool, in the real Workers runtime. */
export function vitestConfigTs(spec: AgentSpec, n: AgentNames): string {
  const T = `Test${n.pascal}`;

  const durableObject = (binding: string, className: string): string =>
    `          ${binding}: {\n            className: "${className}",\n            useSQLite: true\n          }`;

  return render(source, {
    when: { subAgent: spec.subAgent },
    tokens: {
      WORKFLOW_BINDING: n.workflowBinding,
      WORKFLOW_NAME: n.workflowName,
      TEST_WORKFLOW_CLASS: `${T}Workflow`,
      // Two bindings or three: the count is what the sub-agent changes, and a
      // list whose length is computed is a block rather than a region, because
      // which element is last decides where the commas go.
      DURABLE_OBJECTS: [
        durableObject(`TEST_${n.screaming}_HOST`, `${T}Host`),
        durableObject(`TEST_${n.screaming}_AGENT`, `${T}Agent`),
        ...(spec.subAgent
          ? [durableObject(`TEST_${n.screaming}_CHILD`, `${T}Child`)]
          : [])
      ].join(",\n")
    }
  });
}
