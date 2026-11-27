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
import { DEFAULT_MODEL_ID } from "../train";

/**
 * The pin rather than a copy of it: a fixture carrying its own model id is a
 * spec that compares `src/train.ts` with itself, which is how the generated
 * `compatibility_date` came to be asserted against the fixture that produced
 * it. `train.spec.ts` holds this file to naming the constant.
 */
const base = (tenant: string): AgentSpec => ({
  tenant,
  name: displayName(tenant),
  description: "Answers product questions from the handbook.",
  blueprint: "generic",
  subAgent: "general",
  capabilities: [],
  modelId: DEFAULT_MODEL_ID
});

/** A spec with no sub-agent at all. */
const withoutSubAgent = (spec: AgentSpec): AgentSpec => {
  const { subAgent: _, ...rest } = spec;
  return rest;
};

export const specs = {
  /** Everything on: the sub-agent and every capability. */
  full: { ...base("support"), capabilities: ["browser"] } as AgentSpec,
  /** Nothing but the agent itself. */
  bare: withoutSubAgent(base("support")),
  /** A multi-word tenant id, which every derived name has to handle. */
  multiWord: base("release-notes")
} as const;

/**
 * The claude-container blueprint, with the browser and without it. Apart from
 * {@link specs} because a generic spec iterating those has nothing to say about
 * this blueprint's files; a spec about every blueprint reads both.
 */
export const claudeContainerSpecs = {
  full: {
    ...base("support"),
    blueprint: "claude-container",
    subAgent: "claude_code",
    capabilities: ["browser"]
  } as AgentSpec,
  bare: {
    ...base("support"),
    blueprint: "claude-container",
    subAgent: "claude_code"
  } as AgentSpec
} as const;

/** Each fixture with a label, for `describe.each`. */
export const variants = (): { label: string; spec: AgentSpec }[] =>
  Object.entries(specs).map(([label, spec]) => ({ label, spec }));
