import type { AgentNames, AgentSpec } from "../../spec.js";

/** `<dir>/definition.ts` — the tenant, its card and its Durable Object. */
export const definitionTs = (
  spec: AgentSpec,
  n: AgentNames
): string => `import { defineAgent } from "@dynamicagents/core/worker";
import { manifest } from "./manifest";

/**
 * How this agent is reached: its tenant id, its card and its Durable Object,
 * declared once. \`src/index.ts\` mounts the tenant from this.
 *
 * The tenant id is a **public identifier**: a gatekeeper registers against it
 * and it rides in a JWT claim, so changing it later is a re-registration rather
 * than a rename. Every class and binding in this project derives from it.
 */
export const ${n.camel} = defineAgent({
  tenant: "${spec.tenant}",
  manifest,
  agent: (env: Env) => env.${n.hostClass}
});
`;
