/** What `npm create dynamicagents` builds. Pure, so the spec needs no process. */
export interface Kind {
  /** What a user types: `npm create dynamicagents@latest <value>`. */
  value: string;
  label: string;
  /** Shown beside the option the menu has focused. */
  hint: string;
  /** Shown once it is picked. */
  about: string;
  /**
   * Whether this CLI can build one yet. A kind that cannot says so and exits;
   * `src/messages.ts` has the words.
   */
  ready: boolean;
}

export const KINDS: readonly Kind[] = [
  {
    value: "gate",
    label: "Gate",
    hint: "where people and APIs reach your agents",
    about:
      "Gates are the interfaces humans or APIs interact with, like a Slack, WhatsApp or API gate.",
    ready: false
  },
  {
    value: "leader",
    label: "Leader",
    hint: "creates, edits and evaluates a group of agents",
    about:
      "A leader is a powerful agent that can create, edit and evaluate a group of agents.",
    ready: false
  },
  {
    value: "agent",
    label: "Agent",
    hint: "one agent, in a Worker of its own",
    about:
      "An agent in a deployable Cloudflare Worker of its own: its own wrangler config, its own bindings, its own signing key, reached over A2A as its own tenant. Nothing it does can affect another agent, and several can be brought into one Worker later.",
    ready: true
  }
];

/** The kind a command-line argument names, in any case. */
export const kindOf = (arg: string): Kind | undefined =>
  KINDS.find((kind) => kind.value === arg.toLowerCase());
