/**
 * What a generated `package.json` asks for: the pins in `src/train.ts`, narrowed
 * to what this particular agent imports.
 *
 * Pure, and a function of the spec rather than a constant, because an
 * uninstalled capability should not leave a dependency behind: a project with
 * no plugins does not depend on `@dynamicagents/plugins`, and one with no
 * sub-agent does not depend on `zod`.
 */
import { RUNTIME, TOOLCHAIN, TRAIN } from "../train.js";
import type { AgentSpec } from "./spec.js";

/** npm keeps a manifest's dependency maps sorted, so these are too. */
const sorted = (map: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  );

/** The runtime half, in the order npm will keep it. */
export function dependenciesFor(
  spec: Pick<AgentSpec, "subAgent" | "capabilities">
): Record<string, string> {
  const deps: Record<string, string> = {
    "@dynamicagents/core": TRAIN.core,
    "@cloudflare/think": RUNTIME["@cloudflare/think"],
    agents: RUNTIME.agents,
    ai: RUNTIME.ai,
    "workers-ai-provider": RUNTIME["workers-ai-provider"],
    "@a2a-js/sdk": RUNTIME["@a2a-js/sdk"]
  };
  if (spec.subAgent) deps.zod = RUNTIME.zod;
  if (spec.capabilities.length > 0) {
    deps["@dynamicagents/plugins"] = TRAIN.plugins;
  }
  return sorted(deps);
}

/** The toolchain half: what the generated config files are written against. */
export const devDependenciesFor = (): Record<string, string> =>
  sorted({ ...TOOLCHAIN });
