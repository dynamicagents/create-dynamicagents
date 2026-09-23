/** What `npm create dynamicagents` builds. Pure, so the spec needs no process. */
export interface Kind {
  /** What a user types: `npm create dynamicagents@latest <value>`. */
  value: string;
  label: string;
  /** Shown beside the option the menu has focused. */
  hint: string;
  /** Shown once it is picked. */
  about: string;
}

export const KINDS: readonly Kind[] = [
  {
    value: "gate",
    label: "Gate",
    hint: "where people and APIs reach your agents",
    about:
      "Gates are the interfaces humans or APIs interact with, like a Slack, WhatsApp or API gate."
  },
  {
    value: "leader",
    label: "Leader",
    hint: "creates, edits and evaluates a group of agents",
    about:
      "A leader is a powerful agent that can create, edit and evaluate a group of agents."
  },
  {
    value: "agent",
    label: "Agent",
    hint: "one agent, usually created by a leader",
    about:
      "An agent should be created by a leader rather than directly by a developer. It adds a folder with an agent inside a worker and scaffolds it from plugins, significantly cutting the time it takes to deploy a production-ready agent."
  }
];

/** The kind a command-line argument names, in any case. */
export const kindOf = (arg: string): Kind | undefined =>
  KINDS.find((kind) => kind.value === arg.toLowerCase());
