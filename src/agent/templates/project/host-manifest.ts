import type { AgentSpec } from "../../spec.js";
import { stringProp } from "../text.js";

/** `src/host-manifest.ts` — the stub card at the well-known path. */
export function hostManifestTs(spec: AgentSpec): string {
  const description =
    `Hosts a Dynamic Agent behind one A2A endpoint. This card describes the ` +
    `deployment rather than the agent — call GetExtendedAgentCard with a tenant ` +
    `id to fetch an agent's own card. Tenants: \`${spec.tenant}\` (${spec.description.replace(/\.$/, "")}).`;

  const props = [
    stringProp("name", spec.tenant),
    stringProp("description", description),
    '  version: "0.1.0"',
    `  // \`extensions\` is a required (repeated) protobuf field in v1.0, and this
  // deployment declares no protocol extensions, so it stays empty.
  // \`extendedAgentCard\` is set by core, which owns that contract.
  capabilities: { streaming: false, pushNotifications: true, extensions: [] }`,
    '  defaultInputModes: ["text/plain"]',
    '  defaultOutputModes: ["text/plain"]',
    "  skills: []"
  ];

  return `import type { AgentManifest } from "@dynamicagents/core/a2a";

/**
 * The **stub** card served at \`/.well-known/agent-card.json\`.
 *
 * It describes the deployment, not the agent. The agent is a tenant of this
 * endpoint, so this card exists to be the single conformant, signed AgentCard at
 * the URI RFC 8615 and A2A's IANA registration reserve — advertising where to
 * call, which protocol, and that real cards are reachable through
 * \`GetExtendedAgentCard\`.
 *
 * It cannot list tenants as interfaces: a card carries one interface entry and
 * spec §8.3.2 has clients take the first, so one entry per tenant would just
 * make every client address whichever came first. They go in \`description\` for a
 * human reading the deploy in a browser, and are registered out of band.
 *
 * **The description must name every mounted tenant.** It is the only place this
 * card says what is here, so a tenant missing from it is a tenant an operator
 * reading the deploy has no way to discover. Mounting a second agent in
 * \`src/index.ts\` means naming it here too.
 *
 * \`skills\` is empty for the same reason: the skills belong to the tenants, and a
 * client that picked one from here would have no way to act on it.
 */
export const hostManifest: AgentManifest = {
${props.join(",\n")}
};
`;
}
