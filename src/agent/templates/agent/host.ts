import type { AgentNames } from "../../spec";
import { render } from "../render";
import { assigned } from "../text";
import source from "./host.ts.tpl";

/** `<dir>/host.ts` — core's `TaskHost`, which owns each A2A task. */
export const hostTs = (n: AgentNames): string =>
  render(source, {
    tokens: {
      HOST_CLASS: n.hostClass,
      WORKFLOW_CLASS: n.workflowClass,
      // Both break after the `=` once the line passes the print width, which a
      // long tenant id does on its own — so they keep `assigned` and arrive as
      // a block. `../../formatting.spec.ts` sweeps the ids that reach it.
      HOST_BINDINGS: [
        assigned(
          "protected readonly workflowBinding: string",
          n.workflowBinding
        ),
        assigned("protected readonly hostBinding: string", n.hostClass)
      ].join("\n")
    }
  });
