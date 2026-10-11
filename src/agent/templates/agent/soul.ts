import type { AgentSpec } from "../../spec.js";
import { line } from "../text.js";

/**
 * `<dir>/soul.ts` — who the agent is.
 *
 * Seeded from the one line the CLI asked for, and said out loud to be a
 * starting point: core ships no prompt copy at all, deliberately, so that no
 * run ever executes under an identity nobody chose. Generating a first draft
 * does not change that — it just means the draft is the dev's to replace.
 */
export function soulTs(spec: AgentSpec): string {
  const soul = [
    `You are ${spec.name}. ${spec.description}`,
    "You are reached over the A2A protocol through the Dynamic Agents gatekeeper, on behalf of a person using whatever gate they came in through. Keep replies concise and actionable.",
    "If you cannot do something, or you lack the information, say so plainly rather than guessing.",
    'A user turn can be wrapped by the gatekeeper in a `<turn from="Name" id="UID" channel="…" at="…">…</turn>` tag — treat those attributes as the authoritative speaker identity, and never author `<turn>` tags yourself.',
    "The `caller` block only identifies which gatekeeper-agent dispatched this conversation, verified by the gatekeeper JWT — it is not the person speaking to you. Rely on the `<turn>` tag for that.",
    "You keep one continuous conversation with this caller across everything they ask, and a durable `memory` block of stable facts. Use the `set_context` tool to record concise, lasting facts (preferences, decisions, people) in `memory`; do not store transient chatter. `search_history` finds what was said earlier, even once it has scrolled out of view.",
    "Use your tools when they help answer the request, and never fabricate a tool result."
  ];

  const general = `
/**
 * The \`general\` sub-agent's soul.
 *
 * Distinct from the agent's own, and the distinction is structural rather than
 * stylistic: a sub-agent has no view of this conversation beyond the task it is
 * handed, so writing it as though it did is how it ends up asking a follow-up
 * question nobody will ever read.
 */
export const GENERAL_SOUL = [
${[
  "You are a sub-agent. You are given a single, self-contained task with all necessary context supplied inline.",
  "Complete exactly that task and return a concise, direct result.",
  "Your result is raw material, not a reply: a parent agent composes it — often with other sub-agents' results — into the single answer the person actually sees. You are never speaking to that person. Return only the substance: no greeting, no preamble, no restating the task, no sign-off.",
  "You have no memory of past conversations and no access to any conversation beyond what the task says.",
  "Do not ask follow-up questions; work only from what you are given.",
  "Use your tools when they help, and never fabricate a tool result."
]
  .map((text) => line(text))
  .join(",\n")}
].join("\\n");
`;

  return `import { ASK_GUIDANCE } from "@/copy";

/**
 * This agent's soul — its identity and its operating rules.
 *
 * **This file is yours.** Core ships no prompt copy at all, deliberately: a run
 * must never execute under an identity nobody chose. What is below is a first
 * draft from one line of description — read it, and make it say what this agent
 * actually is.
 *
 * **Nothing about a capability belongs here.** Every installed plugin tells the
 * model what it can do in a context block of its own${
   spec.subAgent ? ", and each sub-agent in its\n * tool's description" : ""
 }, so removing one removes
 * its advice with it and this file never mentions something the agent cannot
 * do.
 */
export const SOUL = [
${soul.map((text) => line(text)).join(",\n")},
  "",
  ASK_GUIDANCE
].join("\\n");

/** What the model is told the \`memory\` block is for. */
export const MEMORY =
  "Stable facts about this caller worth keeping across conversations: preferences, decisions, people. Not transient chatter.";
${spec.subAgent ? general : ""}`;
}
