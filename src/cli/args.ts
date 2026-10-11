/**
 * The command line, read. Pure, so the spec needs no process.
 *
 * A module rather than a block in the bin, because `src/cli.ts` runs the whole
 * CLI on import and exits out of it: with the parse in there, nothing about
 * reading an argument could be reached by a spec at all, which is how
 * `--help` came to be an unknown option and a typo came to be told there was no
 * terminal.
 *
 * It answers with data and never with prose — {@link Trouble} says what is
 * wrong, `./messages.ts` says it — so the one thing this file knows about a
 * flag is how `parseArgs` takes it.
 */
import { parseArgs } from "node:util";

/**
 * Every flag, as `parseArgs` takes it.
 *
 * `as const` is load-bearing: it keeps the inference, so `Flags` below is
 * `{ name?: string; subagent?: boolean; … }` rather than a second declaration
 * of the same table that could drift from this one.
 *
 * `allowNegative` is what makes `--no-subagent` an answer rather than an
 * unknown flag, and leaving the booleans without a default is what tells "not
 * given" from "given false".
 *
 * `help` and `version` are flags like any other, rather than a scan of `argv`
 * ahead of the parse: `--description --help` is a description of `--help`, and
 * only the parser knows that.
 */
export const OPTIONS = {
  name: { type: "string" },
  description: { type: "string" },
  dir: { type: "string" },
  model: { type: "string" },
  subagent: { type: "boolean" },
  browser: { type: "boolean" },
  yes: { type: "boolean" },
  "dry-run": { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" }
} as const;

const parse = (args: readonly string[]) =>
  parseArgs({
    args: [...args],
    allowPositionals: true,
    allowNegative: true,
    options: OPTIONS
  });

/** The flags, as the parse answers with them. */
export type Flags = ReturnType<typeof parse>["values"];

/** Why a command line could not be read. Data: `./messages.ts` has the words. */
export type Trouble =
  /** Flags this does not take, spelled as they were typed. */
  | { unknown: readonly string[] }
  /** Node's own diagnosis, which for every other mistake is accurate. */
  | { message: string };

/** What a command line asked for. */
export type Read =
  | { want: "help" }
  | { want: "version" }
  | { want: "run"; flags: Flags; positionals: readonly string[] }
  | { want: "trouble"; trouble: Trouble };

/**
 * The flags this does not take, named exactly as they were typed.
 *
 * A strict parse throws on the first one it meets, and its message offers
 * advice about positional arguments that is wrong-footed for what is almost
 * always a typo. So the same arguments are lexed again without strictness:
 * node's own lexer resolves `--no-subagent` to `subagent` and `-h` to `help`,
 * which leaves exactly the names no option declares.
 */
function unknownIn(args: readonly string[]): string[] {
  const { tokens } = parseArgs({
    args: [...args],
    allowPositionals: true,
    allowNegative: true,
    strict: false,
    tokens: true,
    options: OPTIONS
  });
  const declared = new Set<string>(Object.keys(OPTIONS));
  const unknown: string[] = [];
  for (const token of tokens) {
    if (token.kind !== "option") continue;
    if (declared.has(token.name)) continue;
    if (!unknown.includes(token.rawName)) unknown.push(token.rawName);
  }
  return unknown;
}

/**
 * What this run was asked for, or the trouble with how it was asked.
 *
 * Help beats version when both are given: somebody who asked for both wants
 * something to read.
 */
export function read(args: readonly string[]): Read {
  let values: Flags;
  let positionals: string[];
  try {
    ({ values, positionals } = parse(args));
  } catch (err) {
    const { code, message } = err as NodeJS.ErrnoException;
    if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      const unknown = unknownIn(args);
      // Only if the second lex agrees. It always has; if it ever did not,
      // node's own sentence is better than one naming nothing.
      if (unknown.length > 0) return { want: "trouble", trouble: { unknown } };
    }
    return { want: "trouble", trouble: { message } };
  }
  if (values.help === true) return { want: "help" };
  if (values.version === true) return { want: "version" };
  return { want: "run", flags: values, positionals };
}
