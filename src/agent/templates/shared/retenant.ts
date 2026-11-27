/**
 * A template written for one tenant, rewritten for another.
 *
 * The `claude-container` blueprint is held as a real project rather than as
 * templates, and that is the reason this exists beside `./render.ts` instead of
 * using it: each of its files is a working file of a project whose tenant is
 * `claude-container`, byte for byte, so it can be run, diffed and edited as one.
 * A `$TOKEN` at every name would end that, and the files carry `$` in shell and
 * template strings that `render()` would read as tokens. The exception is the
 * files whose browser region the CLI's answers bind
 * (`../claude-container/files.ts`): those go through `render()` first, so any
 * other `$UPPER` text brought into them has to be bound or reworded.
 *
 * So the names are swapped as text, every spelling in one pass, so that what
 * one replacement writes is never read again by another. Passes in turn would
 * be wrong for a tenant id whose own spellings contain the template's: the
 * PascalCase of `xclaude-container` is `XclaudeContainer`, which holds the
 * camelCase `claudeContainer` a later pass would rewrite a second time.
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
  const pairs = spellings(n, displayName);
  const to = new Map(pairs);
  const any = new RegExp(
    pairs
      .map(([from]) => from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "g"
  );
  return source.replace(any, (from) => to.get(from)!);
}
