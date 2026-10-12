import { describe, expect, it } from "vitest";
import { validateModelId, validateTenant } from "../agent/names";
import {
  asBlueprint,
  asDescription,
  asKind,
  asModelId,
  asTenant,
  DESCRIPTION_MAX,
  replyTo,
  whyNot,
  type Judged
} from "./answers";
import { noTerminal } from "./messages";

/**
 * What a value has to be, and what to do about one that is not.
 *
 * The decision is here rather than in the bin so that this spec is the whole of
 * it: a bad `--name` used to travel through every remaining question and refuse
 * the run at the end, and the only way to see that go the other way without a
 * terminal is to ask the decision itself.
 */

const problemIn = <T>(judged: Judged<T>): string => {
  if (!("problem" in judged)) throw new Error("expected a refusal");
  return judged.problem;
};

const valueIn = <T>(judged: Judged<T>): T => {
  if ("problem" in judged) throw new Error(`refused: ${judged.problem}`);
  return judged.value;
};

describe("the judges", () => {
  it("name a kind and an agent in any case", () => {
    expect(valueIn(asKind("Agent")).value).toBe("agent");
    expect(valueIn(asBlueprint("Generic")).value).toBe("generic");
  });

  it("quote what was typed where it names nothing", () => {
    expect(problemIn(asKind("bot"))).toContain('"bot"');
    expect(problemIn(asBlueprint("coding"))).toContain('"coding"');
  });

  it("refuse a tenant id in `../agent/names.ts`'s own words", () => {
    // One spelling of the rule, wherever it is applied.
    expect(problemIn(asTenant("My Agent"))).toBe(validateTenant("My Agent"));
    expect(problemIn(asModelId("gpt-4o"))).toBe(validateModelId("gpt-4o"));
  });

  it("trim what they accept", () => {
    // A tenant id with a space around it is a directory and a class name with
    // a space in them; every validator trims before it judges, so the value
    // that passes has to be trimmed too.
    expect(valueIn(asTenant("  support  "))).toBe("support");
    expect(valueIn(asModelId(" @cf/openai/gpt-oss-120b "))).toBe(
      "@cf/openai/gpt-oss-120b"
    );
    expect(valueIn(asDescription("  Answers questions  "))).toBe(
      "Answers questions"
    );
  });

  it("refuse a description that is not one line of something", () => {
    expect(problemIn(asDescription("   "))).toMatch(/card/);
    for (const description of [
      'Answers questions\nabout "the handbook"',
      "Answers questions\r\nabout the handbook",
      "Answers questions\u2028about the handbook"
    ]) {
      expect(problemIn(asDescription(description))).toMatch(/one line/i);
    }
    expect(problemIn(asDescription("a".repeat(DESCRIPTION_MAX + 1)))).toMatch(
      /one line/i
    );
  });

  it("take one line with a terminator around it, and write the line", () => {
    // `--description $'A demo agent\n'` is one line, and the value that
    // reaches the templates is the trimmed one — which is what the rule is
    // about. Two lines are still two lines, terminator or no terminator.
    for (const around of ["\n", "\r\n", "\u2028", "\u2029", " \n "]) {
      expect(valueIn(asDescription(`${around}A demo agent${around}`))).toBe(
        "A demo agent"
      );
    }
    expect(problemIn(asDescription("\nA demo\nagent\n"))).toMatch(/one line/i);
    // And nothing but terminators is nothing at all, not one empty line.
    expect(problemIn(asDescription("\n\n"))).toMatch(/card/);
  });
});

describe("whyNot", () => {
  it("is the judge, as a prompt's validate", () => {
    const validate = whyNot(asTenant);
    expect(validate("support")).toBeUndefined();
    expect(validate("My Agent")).toBe(problemIn(asTenant("My Agent")));
  });

  it("treats nothing typed as nothing given", () => {
    // Which is what clack hands a validator for an untouched prompt.
    expect(whyNot(asDescription)(undefined)).toBe(problemIn(asDescription("")));
  });
});

describe("replyTo", () => {
  it("uses a value that will do, and asks nothing", () => {
    expect(replyTo("support", asTenant, { interactive: true })).toEqual({
      kind: "use",
      value: "support"
    });
  });

  it("asks again for a value that will not do, in the prompt's own words", () => {
    // create-cloudflare's `processArgument`, in this repository's shape: the
    // flag's value is judged by the prompt's own validator, and a refusal is a
    // question rather than an exit.
    const reply = replyTo("My Agent", asTenant, {
      interactive: true,
      named: "--name"
    });
    expect(reply).toEqual({
      kind: "ask",
      problem: whyNot(asTenant)("My Agent"),
      initial: "My Agent"
    });
  });

  it("stops on that same value where there is no terminal, naming the flag", () => {
    const reply = replyTo("My Agent", asTenant, {
      interactive: false,
      named: "--name"
    });
    if (reply.kind !== "stop") throw new Error("expected a stop");
    expect(reply.problem).toContain("--name");
    expect(reply.problem).toContain("My Agent");
    expect(reply.problem).toContain(problemIn(asTenant("My Agent")));
    // The mistake is the value, and saying anything about a terminal here is
    // the defect this replaced.
    expect(reply.problem).not.toMatch(/terminal/i);
  });

  it("stops in the judge's words alone where what was typed is already quoted", () => {
    // A positional argument has no flag to name: `unknownKind` quotes it.
    const reply = replyTo("agnet", asKind, { interactive: false });
    expect(reply).toEqual({
      kind: "stop",
      problem: problemIn(asKind("agnet"))
    });
  });

  it("asks where nothing was given and somebody can be asked", () => {
    expect(replyTo(undefined, asTenant, { interactive: true })).toEqual({
      kind: "ask"
    });
  });

  it("stops where nothing was given and nobody can be asked", () => {
    expect(replyTo(undefined, asTenant, { interactive: false })).toEqual({
      kind: "stop",
      problem: noTerminal()
    });
  });

  it("falls back where nothing was given and there is a default", () => {
    expect(
      replyTo(undefined, asModelId, {
        interactive: false,
        fallback: "@cf/zai-org/glm-5.3-flash"
      })
    ).toEqual({ kind: "use", value: "@cf/zai-org/glm-5.3-flash" });
  });

  it("never falls back over a value that will not do", () => {
    // A `--model` nobody can be asked about is a stop: writing a project on
    // the default instead is a project nobody asked for.
    const reply = replyTo("gpt-4o", asModelId, {
      interactive: false,
      named: "--model",
      fallback: "@cf/zai-org/glm-5.3-flash"
    });
    expect(reply.kind).toBe("stop");
  });
});
