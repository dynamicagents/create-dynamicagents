/**
 * The answers the specs generate projects from.
 *
 * Shared rather than written out per spec so that every spec covers the same
 * combinations: a scaffold with a sub-agent and a capability, one with neither,
 * and a multi-word tenant id, which is where a derived class or binding name
 * goes wrong.
 *
 * Not a `.spec.ts` file, and it does not need to be: a user installs one
 * bundle, and nothing but a spec imports this, so the bundle rooted at the bin
 * cannot reach it. `scripts/verify-package.mjs` skips it for the same reason.
 */
import { displayName } from "./names";
import type { AgentSpec } from "./spec";

const base = (tenant: string): AgentSpec => ({
  tenant,
  name: displayName(tenant),
  description: "Answers product questions from the handbook.",
  blueprint: "generic",
  subAgent: true,
  capabilities: [],
  modelId: "@cf/zai-org/glm-5.3-flash",
  compatibilityDate: "2026-07-06"
});

export const specs = {
  /** Everything on: the sub-agent and every capability. */
  full: { ...base("support"), capabilities: ["browser"] } as AgentSpec,
  /** Nothing but the agent itself. */
  bare: { ...base("support"), subAgent: false } as AgentSpec,
  /** A multi-word tenant id, which every derived name has to handle. */
  multiWord: base("release-notes")
} as const;

/** Each fixture with a label, for `describe.each`. */
export const variants = (): { label: string; spec: AgentSpec }[] =>
  Object.entries(specs).map(([label, spec]) => ({ label, spec }));
