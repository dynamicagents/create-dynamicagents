/**
 * Which agent `npm create dynamicagents agent` writes, one of the two menus
 * `./` holds, read by `src/cli.ts` and by nothing a template writes. Pure, so
 * the spec needs no process.
 *
 * An entry is not enough on its own: `../files.ts` writes the generic project
 * for any spec it does not dispatch, so a new entry here needs a dispatch there
 * in the same change, or the menu would offer an agent and write another one.
 * Deliberately nothing listed before it exists, so the menu never offers
 * something that answers with an apology.
 */
import type { SubAgentName } from "../spec";

export interface Blueprint {
  /** What a user types: `npm create dynamicagents@latest agent <value>`. */
  value: string;
  label: string;
  /** Shown beside the option the menu has focused. */
  hint: string;
  /** Shown once it is picked. */
  about: string;
  /**
   * The sub-agent it delegates to, by the tool name its model calls: `general`
   * for research, `claude_code` for a Claude Code session. `optional` is
   * whether the CLI asks for it (`--no-subagent`), or it is what the agent is
   * for and always written.
   */
  subAgent: { name: SubAgentName; optional: boolean };
  /**
   * What the tenant id and the description default to, where a blueprint has
   * an identity of its own. The CLI still takes either, from a flag or a prompt.
   */
  defaults?: { tenant: string; description: string };
}

export const BLUEPRINTS: readonly Blueprint[] = [
  {
    value: "generic",
    label: "Generic",
    hint: "a delegating assistant, and the one to start from",
    about:
      "A delegating assistant: it answers over A2A on a Workers AI model, hands self-contained work to a research sub-agent, and keeps one continuous, self-compacting conversation per caller with a durable memory. Its own Worker, its own wrangler config, its own tenant.",
    subAgent: { name: "general", optional: true }
  },
  {
    value: "claude-container",
    label: "Claude Container",
    hint: "hands tasks to Claude Code sessions in a container",
    about:
      "An agent that hands tasks to Claude Code sessions running in a sandbox container with a full shell, and shares the files they make as links. Needs Containers and at least one `claude setup-token` credential.",
    subAgent: { name: "claude_code", optional: false },
    defaults: {
      tenant: "claude-container",
      description:
        "Gets a task done with Claude Code sessions in a Cloudflare container, and shares the files they make."
    }
  }
];

/** The blueprint a command-line argument names, in any case. */
export const blueprintOf = (arg: string): Blueprint | undefined =>
  BLUEPRINTS.find((blueprint) => blueprint.value === arg.toLowerCase());
