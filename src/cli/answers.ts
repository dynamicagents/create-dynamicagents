/**
 * One answer, however it arrives — an argument on the command line or an answer
 * to a question — and what it has to be for this run to use it. Pure, so the
 * spec needs no process.
 *
 * Two things live here, and they are the same thing twice. A **judge** turns
 * what somebody typed into either a value or the one sentence saying why not;
 * {@link whyNot} hands that same judge to a clack prompt as its `validate`, so a
 * flag and the question it answers refuse in the same words because they are
 * the same function, not because two sentences were kept in step.
 * {@link replyTo} is the decision above it: use what was given, ask for
 * something better, or stop — which is what makes a bad `--name` a re-prompt in
 * a terminal and a refusal before the first question without one, instead of
 * five answered questions and a refusal at the end.
 */
import { validateModelId, validateTenant } from "../agent/names";
import { blueprintOf, type Blueprint } from "../agent/offer/blueprints";
import { kindOf, type Kind } from "./kinds";
import {
  badValue,
  describeOneLine,
  describeTooLong,
  noDescription,
  noTerminal,
  unknownBlueprint,
  unknownKind
} from "./messages";

/** A value this run can use, or the one sentence saying why it cannot. */
export type Judged<T> = { value: T } | { problem: string };

/** What somebody typed, judged. */
export type Judge<T> = (raw: string) => Judged<T>;

/** The longest one-line description worth putting on an agent card. */
export const DESCRIPTION_MAX = 200;

/**
 * Every line terminator JavaScript knows, which is what makes "one line" a rule
 * rather than a hope.
 *
 * A description is written into a TypeScript string literal, a markdown table
 * cell and the agent card. In the first of those a raw newline does not parse,
 * which is what `quoted()`'s single-quoted branch would emit for a description
 * holding a double quote; in the second it ends the table. `--description` is
 * how one arrives — clack's prompt cannot carry a newline.
 *
 * Tested against the trimmed value, deliberately, because the trimmed value is
 * what gets written: `--description $'A demo agent\n'` is one line with a
 * terminator around it, so it is trimmed and used, while `$'A demo\nagent'` is
 * two lines and is refused. The rule is about what reaches the file, not about
 * how the argument was typed.
 */
const LINE_BREAK = /[\n\r\u2028\u2029]/;

export const asKind: Judge<Kind> = (raw) => {
  const kind = kindOf(raw);
  return kind === undefined ? { problem: unknownKind(raw) } : { value: kind };
};

export const asBlueprint: Judge<Blueprint> = (raw) => {
  const blueprint = blueprintOf(raw);
  return blueprint === undefined
    ? { problem: unknownBlueprint(raw) }
    : { value: blueprint };
};

/**
 * The tenant id. Trimmed on the way through, like every judge here: the rules
 * in `../agent/names.ts` trim before they judge, so an id with spaces around it
 * passes — and written untrimmed it is a directory name and a class name with a
 * space in them.
 */
export const asTenant: Judge<string> = (raw) => {
  const problem = validateTenant(raw);
  return problem === undefined ? { value: raw.trim() } : { problem };
};

/** The one line on the card: trimmed, and then held to being one line. */
export const asDescription: Judge<string> = (raw) => {
  const value = raw.trim();
  if (value === "") return { problem: noDescription() };
  if (LINE_BREAK.test(value)) return { problem: describeOneLine() };
  if (value.length > DESCRIPTION_MAX) return { problem: describeTooLong() };
  return { value };
};

export const asModelId: Judge<string> = (raw) => {
  const problem = validateModelId(raw);
  return problem === undefined ? { value: raw.trim() } : { problem };
};

/**
 * A judge as a clack `validate`.
 *
 * Clack asks for `string | undefined` and wants a message or nothing, which is
 * a judge with its value thrown away.
 */
export const whyNot =
  <T>(judge: Judge<T>) =>
  (value: string | undefined): string | undefined => {
    const judged = judge(value ?? "");
    return "problem" in judged ? judged.problem : undefined;
  };

/** What to do about an answer: use it, ask for one, or stop. */
export type Reply<T> =
  | { kind: "use"; value: T }
  /** Ask. `problem` is what to say first, where something was given and will not do. */
  | { kind: "ask"; problem?: string; initial?: string }
  | { kind: "stop"; problem: string };

export interface Where<T> {
  /** Whether there is a terminal to ask in. */
  interactive: boolean;
  /**
   * How to name what carried the value — `--name`, say — for a refusal with no
   * prompt around it to make it obvious. Left out where what was typed is
   * already quoted in the sentence, as a positional argument's is.
   */
  named?: string;
  /** What to use when nothing was given and there is nobody to ask. */
  fallback?: T;
}

/**
 * The decision, as data: what a flag's value and a terminal add up to.
 *
 * Adopted from create-cloudflare's `processArgument`, which runs the prompt's
 * own validator over the flag value and hands the message to the prompt instead
 * of exiting. The shape here is this repository's: the bin prints and asks, so
 * what comes back is a description of that rather than a prompt.
 *
 * A value that will not do never falls back — a `--model` nobody can be asked
 * about is a stop, not a silent default, because the run would otherwise write
 * a project nobody asked for.
 */
export function replyTo<T>(
  given: string | undefined,
  judge: Judge<T>,
  where: Where<T>
): Reply<T> {
  if (given === undefined) {
    if (where.interactive) return { kind: "ask" };
    if (where.fallback !== undefined) {
      return { kind: "use", value: where.fallback };
    }
    return { kind: "stop", problem: noTerminal() };
  }
  const judged = judge(given);
  if (!("problem" in judged)) return { kind: "use", value: judged.value };
  if (where.interactive) {
    // The value is handed back to the prompt, so the fix is an edit rather than
    // a retype — which is most of why this is a re-prompt and not a refusal.
    return { kind: "ask", problem: judged.problem, initial: given };
  }
  return {
    kind: "stop",
    problem:
      where.named === undefined
        ? judged.problem
        : badValue(where.named, given, judged.problem)
  };
}
