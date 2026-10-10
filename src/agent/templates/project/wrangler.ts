import type { AgentNames, AgentSpec } from "../../spec.js";
import { jsonArrayProp, jsonObject } from "../text.js";

/**
 * `wrangler.jsonc` — this agent's own deployment.
 *
 * Prettier keeps the object expansion a JSONC file is written with, so the
 * layout here is the layout the project keeps. The comments are the point of
 * the file as much as the values: every one of them states something that
 * fails far from here when it is wrong.
 */
export function wranglerJsonc(spec: AgentSpec, n: AgentNames): string {
  const browser = spec.capabilities.includes("browser");

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

  const browserBlock = browser
    ? `
  // \`@dynamicagents/plugins/browser\`, installed in
  // ${n.dir}/plugins.ts. Browser Rendering is a paid-plan
  // binding, and \`remote: true\` is required for it under \`wrangler dev\`.
  "browser": {
    "binding": "BROWSER",
    "remote": true
  },
`
    : "";

  return `/**
 * One Worker, one agent.
 *
 * The agent is a **tenant** of this deployment, routed by \`src/index.ts\` on the
 * A2A \`params.tenant\`. That holds with one agent exactly as it would with
 * several, which is what makes adding a second one additive: another directory
 * under \`src/agents/\`, another block in each list below, and a new migration
 * tag. AGENTS.md carries the recipe.
 *
 * https://developers.cloudflare.com/workers/wrangler/configuration/
 */
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "${spec.tenant}",
  "main": "src/index.ts",
  "compatibility_date": "${spec.compatibilityDate}",
  "compatibility_flags": ["nodejs_compat"],

  // **One origin, and keep it.**
  //
  // Core derives the card's interface URL, its \`jku\` and the token audience it
  // verifies from \`new URL(request.url).origin\`. A second origin therefore
  // advertises a second audience, and a gatekeeper token minted for one does
  // not verify against the other — it could only ever serve a card nobody can
  // call.
  //
  // \`workers_dev\` is on so the first deploy is reachable at a URL you already
  // have. Moving to a domain of your own is one change: turn it off, declare
  // the route, deploy, and re-register the tenant with your gatekeeper against
  // the new origin.
  //
  //   "workers_dev": false,
  //   "routes": [{ "pattern": "agents.example.com", "custom_domain": true }]
  "workers_dev": true,

  "observability": {
    "enabled": true
  },

  // --- required by core -----------------------------------------------------

  // Workers AI backs the agent's model, through AI Gateway. There is no model
  // credential in this project: Cloudflare authenticates this binding for the
  // Worker. \`remote: true\` reflects reality — Workers AI has no local execution
  // mode and always hits remote resources — and suppresses wrangler's per-run
  // warning; the test pool turns it off (vitest.config.ts) so no connection is
  // opened per test file.
  "ai": {
    "binding": "AI",
    "remote": true
  },
${browserBlock}
  // The agent's task host, which holds a caller's A2A tasks, and the step agent
  // its pipeline runs on, which holds the SQLite-backed Session — one
  // continuous history plus writable memory. Both are keyed by the verified
  // caller, which is what makes a task unreachable from any other caller by
  // construction.
  //
  // A host's binding is named as its class: \`hostBinding\` in
  // ${n.dir}/host.ts names it, and the pipeline reaches the
  // host through it.
  //${
    spec.subAgent
      ? `
  // The sub-agent class (\`${n.childClass}\`) is deliberately absent. It is a
  // facet created beneath its agent, so it needs no binding and no
  // \`new_sqlite_classes\` entry — only its export from src/index.ts. It does
  // need a test-only binding; see the comment in vitest.config.ts.
  //`
      : ""
  }
  // \`ARTIFACTS\` is **not optional**. Core files every sub-agent note on the
  // task's transcript and posts a link instead of the note, so an agent Durable
  // Object that starts without this binding throws \`ArtifactsNotBoundError\`
  // naming every part of the wiring — the route delegation at the top of
  // \`fetch\` in src/index.ts included, since without that one an artifact URL
  // falls through to routes that know nothing about it. The class is core's
  // own, re-exported unchanged from src/index.ts, and one object serves the
  // whole deployment: a reader arrives holding a token and nothing else, so the
  // object it reaches cannot be keyed by task.
  "durable_objects": {
    "bindings": [
${bindings}
    ]
  },

  // **A tag is applied once, ever.** Anything appended to a tag already
  // deployed is simply never applied: the class is never created, and the
  // failure surfaces far from this file — at the first request to the agent, or
  // at deploy with "New version of script does not export class 'X' which is
  // depended on by existing Durable Objects". Always add a new tag.
  //
  // Removing a class from the code reclaims nothing on its own either: every
  // object it created keeps its storage, unreachable and still billed.
  // \`deleted_classes\` in a new tag is the line that frees them, and it is
  // irreversible.
  "migrations": [
    {
      "tag": "v1",
${jsonArrayProp("new_sqlite_classes", [n.hostClass, n.agentClass, "Artifacts"], 6)}
    }
  ],

  // The agent's pipeline: every task is an instance, its id the task's. The
  // name is derived from the tenant id rather than from this Worker, so moving
  // the agent into another Worker never renames it — a rename would abandon
  // every instance still running under the old name.
  "workflows": [
    {
      "name": "${n.workflowName}",
      "binding": "${n.workflowBinding}",
      "class_name": "${n.workflowClass}"
    }
  ],

  // What an operator fills in; \`.env.example\` says what each one is. Declared
  // here because \`secrets.required\` is what drives type generation and
  // \`wrangler dev\`'s missing-secret warnings — so a name left here and unset is
  // typed as a definite string that is undefined at runtime.
  "secrets": {
${jsonArrayProp("required", ["A2A_SIGNING_KEY", "GATEKEEPER_ORIGINS"], 4)}
  }
}
`;
}
