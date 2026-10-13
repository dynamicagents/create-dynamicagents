import { MERGE_CAVEAT, mergeSteps } from "../merge-notes";
import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import { mdTable } from "../text";
import source from "./AGENTS.md.tpl";

/**
 * `AGENTS.md` — how to work in a generated project.
 *
 * No `CLAUDE.md` beside it: current Claude versions read `AGENTS.md` when there
 * is no `CLAUDE.md`, so a second file would only be a pointer that can rot.
 *
 * Every table goes through `mdTable`, which pads columns the way prettier does.
 * The generated project runs `prettier --check .`, so a hand-aligned table
 * would fail its first check.
 */
export function agentsMd(spec: AgentSpec, n: AgentNames): string {
  // Only said where it is true. A `--no-browser` project has no Browser
  // Rendering binding, and naming a paid service it does not use is how a dev
  // goes looking for a subscription they do not need.
  const browserToo = spec.capabilities.includes("browser")
    ? ", and neither is Browser Rendering"
    : "";

  const where = mdTable(
    ["You are changing…", "It goes in"],
    [
      ["what the agent _is_ — its identity, its rules", `\`${n.dir}/soul.ts\``],
      ["which capabilities it has", `\`${n.dir}/plugins.ts\``],
      [
        "the model, or when the conversation compacts",
        `\`${n.dir}/tuning.ts\``
      ],
      ["what it advertises to a gatekeeper", `\`${n.dir}/manifest.ts\``],
      ["the steps its task runs", `\`${n.dir}/workflow.ts\``],
      ...(spec.subAgent
        ? [["its sub-agent — spec, soul, model", `\`${n.dir}/children.ts\``]]
        : []),
      ["what a person reads when a task ends badly", "`src/copy.ts`"],
      [
        "what the model is told about a domain",
        "the plugin that owns that domain"
      ],
      [
        "cancellation, recovery, idempotency, delegation",
        "**`@dynamicagents/core`** — not here"
      ],
      [
        "the Durable Object a capability runs in",
        "**`@dynamicagents/plugins`** — not here"
      ]
    ]
  );

  const tests = mdTable(
    ["file", "what it pins"],
    [
      [
        "`test/turn.spec.ts`",
        "The whole A2A lifecycle on a scripted model: a gatekeeper-signed request reaches the host, the pipeline runs the agent, and the push callback says what happened."
      ],
      [
        "`test/edge.spec.ts`",
        "The zero-trust edge with no model involved: the signed card, the JWKS, and what an unauthenticated or wrongly-scoped call gets."
      ],
      [
        "`test/soul.spec.ts`",
        "That the soul stays within its rules as it is rewritten."
      ],
      [
        "`test/manifest.spec.ts`",
        "That the card advertises what the agent actually has."
      ],
      [
        "`test/tuning.spec.ts`",
        "That the numbers are consistent with each other."
      ],
      [
        "`test/plugins.spec.ts`",
        "That every installed plugin's bindings exist in `wrangler.jsonc`."
      ]
    ]
  );

  const merge = mdTable(
    ["file", "what to do"],
    mergeSteps(n.dir).map((step) => [`\`${step.path}\``, step.what])
  );

  return render(source, {
    tokens: {
      TENANT: spec.tenant,
      NAME: spec.name,
      BROWSER_TOO: browserToo,
      // Every table keeps its helper: `mdTable` pads each cell to its
      // column's width, so the layout depends on the tenant id in it — and
      // `where` and `merge` vary in their *number of rows* besides.
      WHERE_TABLE: where,
      TESTS_TABLE: tests,
      MERGE_TABLE: merge,
      MERGE_CAVEAT
    }
  });
}
