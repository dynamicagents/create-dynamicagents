import { COMPATIBILITY_DATE } from "../../../train";
import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import { jsonArrayProp, jsonObject } from "../text";
import source from "./wrangler.jsonc.tpl";

/**
 * `wrangler.jsonc` — this agent's own deployment.
 *
 * Prettier keeps the object expansion a JSONC file is written with, so the
 * layout in `./wrangler.jsonc.tpl` is the layout the project keeps. The
 * comments are the point of the file as much as the values: every one of them
 * states something that fails far from here when it is wrong — which is also
 * what makes this the one generated file whose `$when` regions are mostly
 * comment, and the reason a marker line is itself a comment in every language a
 * template uses.
 *
 * The compatibility date is read from `src/train.ts` here rather than carried
 * on the spec: nothing asks for it — no flag, no prompt — so it is a pin like
 * `NODE_ENGINE` in `./package-json.ts`, and read where it is written.
 */
export function wranglerJsonc(spec: AgentSpec, n: AgentNames): string {
  const bindings = [
    [n.hostClass, n.hostClass],
    [n.agentClass, n.agentClass],
    ["Artifacts", "ARTIFACTS"]
  ]
    .map(([className, name]) =>
      jsonObject(
        [
          ["class_name", className!],
          ["name", name!]
        ],
        6
      )
    )
    .join(",\n");

  return render(source, {
    when: {
      browser: spec.capabilities.includes("browser"),
      subAgent: spec.subAgent
    },
    tokens: {
      TENANT: spec.tenant,
      COMPATIBILITY_DATE,
      DIR: n.dir,
      CHILD_CLASS: n.childClass,
      WORKFLOW_NAME: n.workflowName,
      WORKFLOW_BINDING: n.workflowBinding,
      WORKFLOW_CLASS: n.workflowClass,
      // The two lists that keep their helper, because a long tenant id is what
      // decides their layout: `jsonObject` goes one property per line and
      // `jsonArrayProp` one element per line once the line passes the print
      // width, and `../../formatting.spec.ts` sweeps tenant ids across it.
      DO_BINDINGS: bindings,
      /**
       * The tag is static, and is in here anyway: a `$block` cannot stand
       * where the property before it would need a trailing comma, because
       * `trailingComma: "none"` has prettier strip a comma before what it
       * reads as the last property — and a comment is not one. So the block is
       * the whole migration rather than its second line.
       */
      MIGRATION_V1: [
        '      "tag": "v1"',
        jsonArrayProp(
          "new_sqlite_classes",
          [n.hostClass, n.agentClass, "Artifacts"],
          6
        )
      ].join(",\n")
    }
  });
}
