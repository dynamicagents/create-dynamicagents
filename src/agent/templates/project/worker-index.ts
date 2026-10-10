import type { AgentNames, AgentSpec } from "../../spec.js";
import { namedFrom } from "../text.js";

/** `src/index.ts` — the Worker entry: the exports, the mount, the routes. */
export function indexTs(spec: AgentSpec, n: AgentNames): string {
  const from = (name: string, module: string): string =>
    namedFrom("export", [name], `./agents/${spec.tenant}/${module}`);
  const childExport = spec.subAgent
    ? `${from(n.childClass, "children")}\n`
    : "";
  const facetNote = spec.subAgent
    ? `
//
// The sub-agent class is a **facet**: it is created beneath its agent, so it
// needs no wrangler binding and no \`new_sqlite_classes\` entry — only this
// export, so \`ctx.exports\` can resolve it by class name.`
    : "";

  return `import { createA2AWorker } from "@dynamicagents/core/worker";
import { Artifacts, handleArtifactRoute } from "@dynamicagents/core/artifacts";

import { hostManifest } from "./host-manifest";
${namedFrom("import", [n.camel], `./agents/${spec.tenant}/definition`)}

// Durable Objects and Workflows must be exported from the Worker entry so the
// runtime can resolve them by class name: the task host, the pipeline it runs
// each task as, and the step agent the pipeline's steps run on.${facetNote}
${from(n.hostClass, "host")}
${from(n.workflowClass, "workflow")}
${from(n.agentClass, "agent")}
${childExport}
// Core's own class, re-exported unmodified — there is nothing here to subclass,
// and a Durable Object namespace is keyed by class name, so this export is what
// the \`ARTIFACTS\` binding resolves to. Why it is required rather than optional
// sits beside that binding in wrangler.jsonc.
export { Artifacts };

/**
 * One Worker, one agent, addressed by A2A \`tenant\`.
 *
 * \`\`\`
 * /.well-known/agent-card.json   the stub card for this deployment
 * /.well-known/jwks.json         the public key, verifying every card it signs
 * /a2a                           the agent, picked by params.tenant
 * \`\`\`
 *
 * A tenant is required on every request: there is no default agent and no
 * implicit routing, and that holds with one agent exactly as it would with
 * twenty. \`AgentInterface.tenant\` is the A2A mechanism for it, and §8.3.2
 * requires a client to send the value the interface it selected declared.
 *
 * The card is why it is a tenant rather than a path prefix: its location is a
 * **well-known URI**, which RFC 8615 defines per-authority, so this origin
 * serves exactly one card and a gatekeeper pins one key for whatever is behind
 * it. That card is a stub (\`./host-manifest.ts\`); the agent's own comes from
 * \`GetExtendedAgentCard\`.
 *
 * **A second agent in this Worker** is another directory under \`./agents/\`,
 * another \`defineAgent\` imported above, another name in \`agents\` below, and its
 * own bindings and migration tag — AGENTS.md carries the whole recipe.
 */
const a2a = createA2AWorker<Env>({
  manifest: hostManifest,
  agents: [${n.camel}]
});

export default {
  /**
   * The artifact links first, everything else after — and the order is the
   * requirement, not a preference.
   *
   * \`handleArtifactRoute\` answers \`null\` for every path it does not claim, so
   * in front it costs the A2A router nothing and takes nothing from it. Behind
   * it, \`/a/<token>\` reaches a router that knows nothing about the prefix, and
   * what that costs is a link that opens onto the wrong answer rather than a
   * failure anyone notices. The artifact routes are not A2A and deliberately
   * sit outside it: no gatekeeper token, no tenant, and the token in the path is
   * the whole credential.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await handleArtifactRoute(request, env)) ?? a2a(request, env);
  }
} satisfies ExportedHandler<Env>;
`;
}
