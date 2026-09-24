import { createA2AWorker } from "@dynamicagents/core/worker";
import { Artifacts, handleArtifactRoute } from "@dynamicagents/core/artifacts";

import { hostManifest } from "./host-manifest";
import { leader } from "./agents/leader/definition";

// Durable Objects and Workflows must be exported from the Worker entry so the
// runtime can resolve them by class name. `LeaderSubagent` is a **facet**: it
// needs no wrangler binding and no `new_sqlite_classes` entry, only this export,
// so `ctx.exports` can find it.
export { LeaderAgent } from "./agents/leader/agent";
export { LeaderSubagent } from "./agents/leader/subagent";
export { LeaderWorkflow } from "./agents/leader/workflow";

// The workspace: a Durable Object holding one repository's filesystem in
// SQLite, paired with the container that mounts it. A thin subclass of the base
// in `@dynamicagents/plugins/computer`.
export { LeaderWorkspaceDO } from "./agents/leader/workspace-do";

// Not one of our classes, and **not optional**. `CloudflareContainerBackend`
// builds the container's egress loopback with `ctx.exports.WorkspaceProxy`, so
// the class has to be in this module's graph under that exact name. Nothing
// imports it and no binding names it, which makes it look like dead code —
// deleting it compiles cleanly and breaks every container at runtime.
export { WorkspaceProxy } from "@cloudflare/computer";

// Core's own class, shipped whole and re-exported unmodified — there is nothing
// here to subclass, and a namespace is keyed by the class name, so this export
// is what `ARTIFACTS` resolves to. Why it is required rather than optional sits
// beside the binding in wrangler.jsonc.
export { Artifacts };

/**
 * One Worker, one agent, addressed by A2A `tenant`.
 *
 * ```
 * /.well-known/agent-card.json   the stub card for the deployment
 * /.well-known/jwks.json         the public key, verifying the card
 * /a2a                           the leader, as params.tenant "leader"
 * ```
 *
 * The tenant is fixed at `leader` whatever this project is called: the name is
 * this deployment's origin, and the origin is what a gatekeeper registers. Each
 * verified caller gets its own instance of the agent — the tenant picks the
 * agent, the caller's `identity.key` picks the instance.
 */
const a2a = createA2AWorker<Env>({
  manifest: hostManifest,
  agents: [leader]
});

export default {
  /**
   * The artifact links first, everything else after — and the order is the
   * requirement, not a preference.
   *
   * `handleArtifactRoute` answers `null` for every path it does not claim, so
   * in front it costs the A2A router nothing and takes nothing from it. Behind
   * it, `/a/<token>` reaches a router that knows nothing about the prefix, and
   * what that costs is a link that opens onto the wrong answer rather than a
   * failure anyone notices. The artifact routes are not A2A and deliberately
   * sit outside it: no gatekeeper token, no tenant, and the token in the path
   * is the whole credential.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await handleArtifactRoute(request, env)) ?? a2a(request, env);
  }
} satisfies ExportedHandler<Env>;
