/**
 * The capabilities the scaffold can install. Pure, so the spec needs no process.
 *
 * A capability is only offered when this CLI can write **all** of it: the line
 * in `plugins.ts`, the binding in `wrangler.jsonc`, and the skill on the agent
 * card. A plugin declares the bindings it needs and core checks them when the
 * agent starts, so installing one without its binding is an agent that throws
 * on its first request rather than a missing feature.
 *
 * That is why `browser` is alone here. The rest of `@dynamicagents/plugins` —
 * a container workspace, git and pull requests, a scratchpad, Claude Code —
 * wants a container, a Dockerfile, credentials and an egress policy, which is a
 * blueprint of its own rather than a line in this list.
 */
import type { Capability } from "./spec.js";

export interface CapabilityOption {
  value: Capability;
  label: string;
  hint: string;
}

export const CAPABILITIES: readonly CapabilityOption[] = [
  {
    value: "browser",
    label: "Read web pages",
    hint: "@dynamicagents/plugins/browser — needs the BROWSER binding"
  }
];

/** The capability a command-line flag names. */
export const capabilityOf = (arg: string): Capability | undefined =>
  CAPABILITIES.find((option) => option.value === arg.toLowerCase())?.value;
