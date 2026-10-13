import type { AgentManifest } from "@dynamicagents/core/a2a";

/**
 * The transport-independent half of this agent's AgentCard — everything that
 * does not depend on the request origin. Core adds `supportedInterfaces` (the
 * deployment's `/a2a` url, tagged with this agent's tenant id) and the security
 * scheme. It is served through `GetExtendedAgentCard`, since the well-known
 * path carries the deployment's stub card — `src/host-manifest.ts`.
 *
 * `AgentManifest` is core's, derived from the A2A SDK's `AgentCard` rather than
 * hand-declared, so a protocol field that gains a requirement fails the build
 * here instead of silently going unadvertised.
 *
 * **The skills are what this agent has.** Adding a capability in
 * `./plugins.ts`, or a sub-agent in `./children.ts`, means a skill here;
 * removing one means removing it. Each skill's `inputModes`, `outputModes` and
 * `securityRequirements` are empty, which means "inherit the card's" — the
 * default modes below, and the gatekeeper JWT.
 */
export const manifest: AgentManifest = {
  // $block CARD_IDENTITY
  version: "0.1.0",
  // `extensions` is a required (repeated) protobuf field in v1.0, and this
  // agent declares no protocol extensions, so it stays empty.
  capabilities: { streaming: false, pushNotifications: true, extensions: [] },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    // $block SKILLS
  ]
};
