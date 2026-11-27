import type { AgentManifest } from "@dynamicagents/core/a2a";

/**
 * The transport-independent half of this agent's AgentCard. `buildBaseCard`
 * adds `supportedInterfaces` (the deployment's shared `/a2a` url, tagged with
 * this agent's tenant id) and the security scheme. Served via
 * `GetExtendedAgentCard`, since the well-known path carries the deployment's
 * stub card.
 *
 * Names no model. A card is what a gatekeeper operator reads to decide what to
 * route here, and what belongs on it is what they can act on.
 */
export const manifest: AgentManifest = {
  name: "Claude Container",
  description:
    "Gets a task done with Claude Code sessions running in a container with a full shell: they write and run code, process files and fetch from the web. Replies with what was done and links to the files it made.",
  version: "0.1.0",
  // `extensions` empty, `extendedAgentCard` unset: core's `AgentManifest`.
  capabilities: { streaming: false, pushNotifications: true, extensions: [] },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    {
      id: "run-task",
      name: "Run a task in a container",
      description:
        "Hand over a task that needs code written and run: a script, a data transformation, a file to produce. A Claude Code session does it in a scratchpad and the files come back as links.",
      tags: ["code", "files", "scripts"],
      examples: [
        "Write a script that turns this CSV into JSON grouped by country, run it, and send me the output.",
        "Generate a markdown report of the 20 most common words in the text I pasted."
      ],
      // Empty means "inherit the card's defaultInput/OutputModes".
      inputModes: [],
      outputModes: [],
      // Empty means "inherit the card-level requirement" (the gatekeeper JWT).
      securityRequirements: []
    }
  ]
};
