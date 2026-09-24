import type { AgentManifest } from "@dynamicagents/core/a2a";

/**
 * The **stub** card served at `/.well-known/agent-card.json`.
 *
 * It describes the deployment, not the agent. The agent is a tenant of this
 * endpoint, so this card exists to be the single conformant, signed AgentCard
 * at the URI RFC 8615 and A2A's IANA registration reserve — advertising where to
 * call, which protocol, and that the real card is reachable through
 * `GetExtendedAgentCard`.
 *
 * It cannot list the tenant as an interface: spec §8.3.2 has clients take the
 * first interface, and core builds that one for the deployment. The tenant goes
 * in `description` for a human reading the deploy in a browser, and is
 * registered out of band.
 *
 * `skills` is empty for the same reason: the skills belong to the tenant, and a
 * client that picked one from here would have no way to act on it.
 */
export const hostManifest: AgentManifest = {
  name: "leader",
  description:
    "Hosts a Dynamic Agents Leader behind one A2A endpoint. This card describes " +
    "the deployment rather than the agent — call GetExtendedAgentCard with the " +
    "tenant id to fetch the agent's own card. Tenant: `leader` (leads changes " +
    "in a git repository through its subagents and opens pull requests).",
  version: "0.1.0",
  // `extensions` is a required (repeated) protobuf field in v1.0 — we declare no
  // protocol extensions, so it stays empty. `extendedAgentCard` is set by core,
  // which owns that contract.
  capabilities: { streaming: false, pushNotifications: true, extensions: [] },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: []
};
