import { defineAgent } from "@dynamicagents/core/worker";
import { manifest } from "./manifest";

/**
 * How this agent is reached: its tenant id, its card, its Durable Object, and the
 * Workflow its turns run on — declared once.
 *
 * `src/index.ts` mounts the tenant from this, and `./workflow.ts` resolves its DO
 * stub from this, so the two cannot address different Durable Objects.
 */
export const leader = defineAgent({
  tenant: "leader",
  manifest,
  agent: (env: Env) => env.LeaderAgent,
  workflow: (env: Env) => env.LEADER_WORKFLOW
});
