/**
 * A template written for one tenant, rewritten for another.
 *
 * The `claude-container` blueprint is held as a real project rather than as
 * templates, and that is the reason this exists beside `./render.ts` instead of
 * using it: each of its files is a working file of a project whose tenant is
 * `claude-container`, byte for byte, so it can be run, diffed and edited as one.
 * A `$TOKEN` at every name would end that, and the files carry `$` in shell and
 * template strings that `render()` would read as tokens. The exception is the
 * four files whose browser region or `$BROWSER_TOO` the CLI's answers bind
 * (`../claude-container/files.ts`): those go through `render()` first, so any
 * other `$UPPER` text brought into them has to be bound or reworded.
 *
 * So the names are swapped as text, longest and most specific spelling first.
 * Each spelling is distinct from the others in case, separator or both, and a
 * tenant id is lowercase letters, digits and single dashes (`../names.ts`), so
 * no replacement can produce a spelling a later one would match again.
 */
import type { AgentNames } from "../../spec";

/** The tenant every `claude-container` template is written for. */
export const TEMPLATE_TENANT = "claude-container";

/** Every spelling of {@link TEMPLATE_TENANT} a template uses, and what it becomes. */
const spellings = (n: AgentNames, displayName: string): [string, string][] => [
  ["ClaudeContainer", n.pascal],
  ["CLAUDE_CONTAINER", n.screaming],
  ["claudeContainer", n.camel],
  ["Claude Container", displayName],
  [TEMPLATE_TENANT, n.tenant]
];

/**
 * `source` with every spelling of {@link TEMPLATE_TENANT} replaced by the
 * tenant `n` names. The identity for the template's own tenant.
 */
export function retenant(
  source: string,
  n: AgentNames,
  displayName: string
): string {
  let out = source;
  for (const [from, to] of spellings(n, displayName)) {
    out = out.split(from).join(to);
  }
  return out;
}
