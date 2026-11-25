/**
 * The Browser Rendering clause of the paid-plan requirement a generated project
 * states in its `README.md` and its `AGENTS.md`.
 *
 * **Prose, and not a plan check.** A paid Workers plan is assumed everywhere,
 * which `AGENTS.md` states under "A paid Workers plan is assumed": nothing in
 * this package or in what it writes asks which plan somebody is on, offers a
 * free-tier path or falls back to one. What varies here is whether the project
 * installed Browser Rendering, which decides whether the sentence names a
 * second paid service or stops at the model.
 *
 * In `templates/` beside `merge-notes.ts` rather than in `templates/project/`:
 * this folder is what a template reads, and `templates/project/` is what a
 * template writes. `project/readme.ts` and `project/agents-md.ts` are the
 * callers, each binding it into a sentence of its own, and that more than one
 * of them states it is why this has a home at all: the phrase and the condition
 * on it were written out at each.
 */
import type { AgentSpec } from "../spec";

/**
 * The clause, as a mid-sentence phrase, or nothing.
 *
 * Only said where it is true. A `--no-browser` project has no Browser
 * Rendering binding, and naming a paid service it does not use is how a dev
 * goes looking for a subscription they do not need. The condition sits in here
 * with the words so that a caller cannot state the clause unconditionally by
 * taking the phrase and leaving the rule behind.
 */
export const browserAlsoPaid = (spec: AgentSpec): string =>
  spec.capabilities.includes("browser")
    ? ", and neither is Browser Rendering"
    : "";
