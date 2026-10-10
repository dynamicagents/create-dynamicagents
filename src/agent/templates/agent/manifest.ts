import type { AgentSpec } from "../../spec.js";
import { quoted, stringProp } from "../text.js";

interface Skill {
  id: string;
  name: string;
  description: string;
  tags: readonly string[];
}

const CHAT: Skill = {
  id: "chat",
  name: "Chat",
  description:
    "Answer the caller on a Workers AI model, calling tools when useful.",
  tags: ["chat", "assistant"]
};

const DELEGATE: Skill = {
  id: "delegate",
  name: "Research and self-contained work",
  description:
    "Hand self-contained pieces of a request to sub-agents, several at once when it splits cleanly, then compose their results into one answer.",
  tags: ["research", "delegation"]
};

const BROWSE: Skill = {
  id: "browse",
  name: "Browse the web",
  description:
    "Read and scrape live web pages — render a page as Markdown, extract structured data, or list its links.",
  tags: ["web", "browser"]
};

const render = (skill: Skill): string => {
  const props = [
    stringProp("id", skill.id, 6),
    stringProp("name", skill.name, 6),
    stringProp("description", skill.description, 6),
    `      tags: [${skill.tags.map(quoted).join(", ")}]`,
    "      examples: []",
    "      inputModes: []",
    "      outputModes: []",
    "      securityRequirements: []"
  ];
  return `    {\n${props.join(",\n")}\n    }`;
};

/**
 * `<dir>/manifest.ts` — the agent card.
 *
 * Its skills are the installed capabilities and nothing else: a card
 * advertising what the agent cannot do is worse than a short card.
 */
export function manifestTs(spec: AgentSpec): string {
  const skills = [
    CHAT,
    ...(spec.subAgent ? [DELEGATE] : []),
    ...(spec.capabilities.includes("browser") ? [BROWSE] : [])
  ];
  const props = [
    stringProp("name", spec.name),
    stringProp("description", spec.description),
    '  version: "0.1.0"',
    `  // \`extensions\` is a required (repeated) protobuf field in v1.0, and this
  // agent declares no protocol extensions, so it stays empty.
  capabilities: { streaming: false, pushNotifications: true, extensions: [] }`,
    '  defaultInputModes: ["text/plain"]',
    '  defaultOutputModes: ["text/plain"]',
    `  skills: [\n${skills.map(render).join(",\n")}\n  ]`
  ];

  return `import type { AgentManifest } from "@dynamicagents/core/a2a";

/**
 * The transport-independent half of this agent's AgentCard — everything that
 * does not depend on the request origin. Core adds \`supportedInterfaces\` (the
 * deployment's \`/a2a\` url, tagged with this agent's tenant id) and the security
 * scheme. It is served through \`GetExtendedAgentCard\`, since the well-known
 * path carries the deployment's stub card — \`src/host-manifest.ts\`.
 *
 * \`AgentManifest\` is core's, derived from the A2A SDK's \`AgentCard\` rather than
 * hand-declared, so a protocol field that gains a requirement fails the build
 * here instead of silently going unadvertised.
 *
 * **The skills are what this agent has.** Adding a capability in
 * \`./plugins.ts\`, or a sub-agent in \`./children.ts\`, means a skill here;
 * removing one means removing it. Each skill's \`inputModes\`, \`outputModes\` and
 * \`securityRequirements\` are empty, which means "inherit the card's" — the
 * default modes below, and the gatekeeper JWT.
 */
export const manifest: AgentManifest = {
${props.join(",\n")}
};
`;
}
