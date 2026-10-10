/**
 * Which agent `npm create dynamicagents agent` writes. Pure, so the spec needs
 * no process.
 *
 * One entry today. The others — a coding agent, a coordinator — are entries
 * here when they are built. An entry is not enough on its own: `./files.ts`
 * writes the generic project for any spec and does not read `spec.blueprint`,
 * so a second entry here needs a dispatch there in the same change, or the
 * menu would offer an agent and write this one. Deliberately not listed before
 * they exist, so it never offers something that answers with an apology.
 */
export interface Blueprint {
  /** What a user types: `npm create dynamicagents@latest agent <value>`. */
  value: string;
  label: string;
  /** Shown beside the option the menu has focused. */
  hint: string;
  /** Shown once it is picked. */
  about: string;
}

export const BLUEPRINTS: readonly Blueprint[] = [
  {
    value: "generic",
    label: "Generic",
    hint: "a delegating assistant, and the one to start from",
    about:
      "A delegating assistant: it answers over A2A on a Workers AI model, hands self-contained work to a research sub-agent, and keeps one continuous, self-compacting conversation per caller with a durable memory. Its own Worker, its own wrangler config, its own tenant."
  }
];

/** The blueprint a command-line argument names, in any case. */
export const blueprintOf = (arg: string): Blueprint | undefined =>
  BLUEPRINTS.find((blueprint) => blueprint.value === arg.toLowerCase());
