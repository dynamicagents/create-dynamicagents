import { MODELS_URL } from "../../../train";
import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import { mdTable } from "../text";
import source from "./README.md.tpl";

/** `README.md` — what this is, how to run it, how to put it in front of people. */
export function readmeMd(spec: AgentSpec, n: AgentNames): string {
  const browser = spec.capabilities.includes("browser");

  /**
   * The two bullets that are there only when the thing they describe is, as
   * mid-sentence phrases rather than `$when` regions: prettier splits a
   * markdown list and inserts blank lines around an `<!-- … -->` between two
   * items, so a region in a `.md.tpl` would reformat the text it holds.
   * `../render.ts` says the same, and it is why markdown varies by token only.
   */
  const delegation = spec.subAgent
    ? "\n- **Delegates.** Self-contained pieces of a request go to a sub-agent and come back composed into one answer.\n"
    : "";
  const capabilities = browser
    ? "\n- **Reads web pages**, through Browser Rendering.\n"
    : "";

  const registration = mdTable(
    ["endpoint", "tenant id"],
    [["`https://<your-worker>/a2a`", `\`${spec.tenant}\``]]
  );

  const files = mdTable(
    ["file", "what it decides"],
    [
      [
        `[\`${n.dir}/soul.ts\`](${n.dir}/soul.ts)`,
        "Who the agent is. **Start here** — it was seeded from one line."
      ],
      [
        `[\`${n.dir}/plugins.ts\`](${n.dir}/plugins.ts)`,
        "What it can do. One line per capability."
      ],
      [
        `[\`${n.dir}/tuning.ts\`](${n.dir}/tuning.ts)`,
        `Its model, and when the conversation compacts. Every model id is at ${MODELS_URL}`
      ],
      [
        `[\`${n.dir}/manifest.ts\`](${n.dir}/manifest.ts)`,
        "What it advertises to a gatekeeper."
      ],
      [
        `[\`${n.dir}/workflow.ts\`](${n.dir}/workflow.ts)`,
        "The steps a task runs. One today."
      ],
      [
        "[`src/copy.ts`](src/copy.ts)",
        "What a person reads when a task ends badly."
      ]
    ]
  );

  return render(source, {
    tokens: {
      NAME: spec.name,
      DESCRIPTION: spec.description,
      TENANT: spec.tenant,
      DELEGATION: delegation,
      CAPABILITIES: capabilities,
      BROWSER_NOTE: browser ? ", and neither is Browser Rendering" : "",
      // Both tables keep their helper: `mdTable` pads every cell to its
      // column's width, so the layout depends on the tenant id in it.
      REGISTRATION: registration,
      FILES_TABLE: files
    }
  });
}
