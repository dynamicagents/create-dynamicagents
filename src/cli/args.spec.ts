import { describe, expect, it } from "vitest";
import { OPTIONS, read, type Flags } from "./args.js";

/**
 * Reading the command line, and the reason it is a module: `src/cli.ts` runs
 * the whole CLI on import and exits out of it, so with the parse inline in the
 * bin there was nothing here a spec could reach — which is how `--help` came to
 * be an unknown option and how a mistyped flag came to be told there was no
 * terminal to ask in.
 */

const run = (
  ...args: string[]
): { flags: Flags; positionals: readonly string[] } => {
  const parsed = read(args);
  if (parsed.want !== "run") {
    throw new Error(`expected a run, got "${parsed.want}"`);
  }
  return parsed;
};

const trouble = (...args: string[]) => {
  const parsed = read(args);
  if (parsed.want !== "trouble") {
    throw new Error(`expected trouble, got "${parsed.want}"`);
  }
  return parsed.trouble;
};

const said = (...args: string[]): string => {
  const problem = trouble(...args);
  if (!("message" in problem)) {
    throw new Error("expected node's own message");
  }
  return problem.message;
};

const unknown = (...args: string[]): readonly string[] => {
  const problem = trouble(...args);
  if (!("unknown" in problem)) {
    throw new Error("expected unknown flags");
  }
  return problem.unknown;
};

describe("read", () => {
  it("answers --help and --version, long and short", () => {
    expect(read(["--help"]).want).toBe("help");
    expect(read(["-h"]).want).toBe("help");
    expect(read(["--version"]).want).toBe("version");
    expect(read(["-v"]).want).toBe("version");
  });

  it("answers either one wherever it sits", () => {
    expect(read(["agent", "generic", "--yes", "--help"]).want).toBe("help");
  });

  it("reads help when both are asked for", () => {
    // Somebody who asked for both wants something to read.
    expect(read(["--version", "--help"]).want).toBe("help");
  });

  it("keeps --help as a value where a flag takes one", () => {
    // Which is why these are options rather than a scan of argv: only the
    // parser knows that this is a description, however odd a one.
    expect(run("--description=--help").flags.description).toBe("--help");
    // Spelled with a space it is nobody's guess, and node says so and says how
    // to spell it instead.
    expect(said("--description", "--help")).toMatch(/ambiguous/);
  });

  it("takes every flag it declares", () => {
    // Driven from the table, so a flag added there and forgotten here fails.
    const asked = Object.entries(OPTIONS).filter(
      ([key]) => key !== "help" && key !== "version"
    );
    const { flags } = run(
      ...asked.flatMap(([key, option]) =>
        option.type === "string" ? [`--${key}`, "x"] : [`--${key}`]
      )
    );
    for (const [key, option] of asked) {
      expect(flags[key as keyof Flags], key).toBe(
        option.type === "string" ? "x" : true
      );
    }
  });

  it("tells a flag left out from one given false", () => {
    // What `allowNegative` and the missing defaults are for: an answer of
    // `false` is an answer, and no answer is a question to ask.
    expect(run("--no-subagent").flags.subagent).toBe(false);
    expect(run("--subagent").flags.subagent).toBe(true);
    expect(run().flags.subagent).toBeUndefined();
  });

  it("keeps the positionals in order, flags between them or not", () => {
    expect(run("agent", "generic", "support").positionals).toEqual([
      "agent",
      "generic",
      "support"
    ]);
    expect(run("agent", "--yes", "generic").positionals).toEqual([
      "agent",
      "generic"
    ]);
  });

  it("names a flag it does not take", () => {
    expect(unknown("--hepl")).toEqual(["--hepl"]);
    expect(unknown("-x")).toEqual(["-x"]);
  });

  it("names every flag it does not take, not only the first", () => {
    // A strict parse throws on the first one it meets; the second lex is what
    // sees the rest of them.
    expect(unknown("--hepl", "--brwoser")).toEqual(["--hepl", "--brwoser"]);
  });

  it("names none of the flags it does take", () => {
    // The second lex is not strict, so `--no-subagent` and `-h` resolve
    // through the table rather than looking like flags nobody declared.
    expect(unknown("--no-subagent", "-h", "--hepl")).toEqual(["--hepl"]);
  });

  it("passes node's own diagnosis for a value that will not parse", () => {
    // Accurate and short, unlike its unknown-option advice.
    expect(said("--yes=foo")).toMatch(/does not take an argument/);
    expect(said("--name")).toMatch(/argument missing/);
  });
});
