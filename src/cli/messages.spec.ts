import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLUEPRINTS } from "../agent/offer/blueprints";
import { projectFiles } from "../agent/files";
import { specs } from "../agent/fixtures";
import { OPTIONS } from "./args";
import { KINDS, kindOf } from "./kinds";
import {
  badArgument,
  badValue,
  finishByHand,
  FLAGS,
  help,
  link,
  nextSteps,
  noTerminal,
  notEmpty,
  notInstalled,
  otherModelLabel,
  outroLine,
  tenantHelp,
  tree,
  unknownBlueprint,
  unknownKind,
  title,
  WEBSITE,
  workInProgress
} from "./messages";
import { MODELS_URL } from "../train";

/** Prettier's print width, which is what these messages are laid out for. */
const PRINT_WIDTH = 80;

/** A flag as it is typed, out of how the help spells it: `--help, -h` → `--help`. */
const flagName = (spelled: string): string => spelled.split(/[\s,]/)[0]!;

/** The module the spec below is about, as `modules()` names it: under `src/`. */
const SUBJECT = "cli/messages.ts";

/**
 * A source file with its comments taken out, so that naming a message in prose
 * is never mistaken for saying it. String and template literals are kept, which
 * is what keeps a `//` inside one from ending a line early.
 */
const code = (source: string): string =>
  source.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (match) => (match.startsWith("/") ? " " : match)
  );

/** Every module the bin is bundled from, as code. No spec is one of them. */
const modules = (): { path: string; code: string }[] => {
  const src = new URL("../", import.meta.url);
  return readdirSync(src, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".spec.ts"))
    .map((path) => ({
      path,
      code: code(readFileSync(new URL(path, src), "utf8"))
    }));
};

/**
 * Which messages a module reads, by the two forms this package uses: the
 * namespace the bin imports `./messages` as, and a named import of it. A form
 * neither of those covers fails the spec below rather than passing it quietly,
 * which is the direction to fail in for a check nothing else backs up.
 */
const reads = (source: string): string[] => [
  ...[...source.matchAll(/\bsay\.(\w+)/g)].map((match) => match[1]!),
  ...[...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*messages"/g)]
    .flatMap((match) => match[1]!.split(","))
    .map(
      (named) =>
        named
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]!
    )
    .filter((name) => name !== "")
];

/** How many times a name appears in a source: its declaration is one of them. */
const uses = (source: string, name: string): number =>
  [...source.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;

describe("title", () => {
  it("names the version that ran", () => {
    expect(title("1.2.3")).toContain("create-dynamicagents v1.2.3");
  });
});

describe("workInProgress", () => {
  it("names the kind and where to follow it", () => {
    const text = workInProgress(kindOf("leader")!);
    expect(text).toContain("Leader");
    expect(text).toContain(WEBSITE);
  });
});

describe("FLAGS", () => {
  /**
   * A flag arrives whole: the entry in `./args.ts`'s `OPTIONS`, the line in the
   * help, the row in `README.md`. Two out of three is a flag that works and is
   * undiscoverable, or one that is documented and refused.
   */
  it("documents every flag the parse takes, and no others", () => {
    expect([...FLAGS].map((flag) => flag.key).sort()).toEqual(
      Object.keys(OPTIONS).sort()
    );
  });

  it("says what each one answers", () => {
    for (const flag of FLAGS) {
      expect(flag.spelled, flag.key).toMatch(/^--/);
      expect(flag.answers, flag.key).not.toBe("");
    }
  });

  it("is the table README.md documents", () => {
    const readme = readFileSync(
      new URL("../../README.md", import.meta.url),
      "utf8"
    );
    for (const flag of FLAGS) {
      expect(readme, flag.key).toContain(`\`${flagName(flag.spelled)}\``);
    }
  });
});

describe("every message", () => {
  /**
   * The exhaustiveness above covers the flags. This covers everything else in
   * the module, because a string nothing reads is a sentence nobody is ever
   * shown, and a docstring saying where it is shown does not make it so.
   *
   * Read out of the source rather than out of an import: what a bin *says* is
   * not a property an imported function has, so what is checkable is whether
   * the module that prints names the message at all. That is weaker than
   * watching a terminal, and it is the whole of what nothing else was checking.
   */
  it("is said by a module that prints, or composed into one that is", () => {
    const all = modules();
    const own = all.find((module) => module.path === SUBJECT);
    expect(own, SUBJECT).toBeDefined();
    const subject = own!.code;

    const said = new Set(
      all
        .filter((module) => module.path !== SUBJECT)
        .flatMap((module) => reads(module.code))
    );

    const unread = [...subject.matchAll(/^export (?:const|function) (\w+)/gm)]
      .map((match) => match[1]!)
      // Not said anywhere, and used nowhere in the module either: one
      // occurrence is the declaration, so a second is what makes it composed
      // into a message that is said.
      .filter((name) => !said.has(name) && uses(subject, name) < 2);

    expect(unread).toEqual([]);
  });
});

describe("help", () => {
  it("names the version that would run", () => {
    expect(help("1.2.3")).toContain("1.2.3");
  });

  it("shows both ways in: the questions, and every answer up front", () => {
    const text = help("1.2.3");
    expect(text).toContain("npm create dynamicagents@latest");
    expect(text).toContain("agent");
    expect(text).toContain("--name <tenant>");
  });

  it("lists every kind and every flag", () => {
    const text = help("1.2.3");
    for (const kind of KINDS) expect(text, kind.value).toContain(kind.value);
    for (const flag of FLAGS) {
      expect(text, flag.key).toContain(flag.spelled);
      expect(text, flag.key).toContain(flag.answers);
    }
  });

  it("warns about npm's own argument separator", () => {
    expect(help("1.2.3")).toMatch(/npm's/);
  });
});

describe("noTerminal", () => {
  it("lists every kind, and every flag an answer can arrive as", () => {
    const text = noTerminal();
    for (const kind of KINDS) expect(text).toContain(kind.value);
    for (const flag of FLAGS) {
      expect(text, flag.key).toContain(flag.spelled);
    }
  });

  it("warns about npm's own argument separator", () => {
    // `npm create x agent --name y` keeps the flags for npm. Everybody hits
    // this once; the message is where they find out.
    expect(noTerminal()).toContain("--");
    expect(noTerminal()).toMatch(/npm's/);
  });
});

describe("the printed width", () => {
  /**
   * Both of these are read in a pipe as often as in a terminal, and a wrapped
   * column is unreadable in either. Held here rather than eyeballed, the way
   * `../agent/formatting.spec.ts` holds the widths of what gets written.
   */
  it("keeps every line of the help and the refusal inside it", () => {
    for (const [what, text] of [
      ["help", help("1.2.3")],
      ["noTerminal", noTerminal()]
    ] as const) {
      for (const line of text.split("\n")) {
        expect(line.length, `${what}: ${line}`).toBeLessThanOrEqual(
          PRINT_WIDTH
        );
      }
    }
  });

  /**
   * What is printed above a prompt has less of the width to spend: clack puts
   * its guide and two spaces in front of every line and wraps none of them, so
   * a line that fits the print width here is one the terminal leaves alone.
   */
  it("leaves clack's guide room in the help above a prompt", () => {
    const GUIDE = "│  ".length;
    for (const line of tenantHelp.split("\n")) {
      expect(line.length + GUIDE, line).toBeLessThanOrEqual(PRINT_WIDTH);
    }
  });
});

describe("badArgument", () => {
  /**
   * The regression this message exists for: every parse error used to carry
   * "No terminal to ask in", because that was the first line of the only usage
   * message in the package. A typo in a terminal was told there was no
   * terminal.
   */
  it("names the flags it does not take, and lists the ones it does", () => {
    const text = badArgument({ unknown: ["--hepl"] });
    expect(text).toContain("`--hepl`");
    expect(text).toMatch(/is not a flag/);
    for (const flag of FLAGS) expect(text, flag.key).toContain(flag.spelled);
  });

  it("names every one of several", () => {
    const text = badArgument({ unknown: ["--hepl", "-x"] });
    expect(text).toContain("`--hepl`");
    expect(text).toContain("`-x`");
    expect(text).toMatch(/are not flags/);
  });

  it("carries node's own diagnosis of anything else", () => {
    const text = badArgument({
      message: "Option '--yes' does not take an argument"
    });
    expect(text).toContain("Option '--yes' does not take an argument");
  });

  it("says nothing about a terminal, whichever it is", () => {
    expect(badArgument({ unknown: ["--hepl"] })).not.toMatch(/terminal/i);
    expect(
      badArgument({ message: "Option '--name <value>' argument missing" })
    ).not.toMatch(/terminal/i);
    // Which leaves one message that mentions one, and it is the run that has
    // none.
    expect(noTerminal()).toMatch(/terminal/i);
  });
});

describe("badValue", () => {
  it("names the flag, the value, and why it will not do", () => {
    // What a prompt would have made obvious, for a run with no prompts in it.
    const text = badValue("--name", "My Agent", "Lowercase letters.");
    expect(text).toContain("--name");
    expect(text).toContain("My Agent");
    expect(text).toContain("Lowercase letters.");
    expect(text).not.toMatch(/terminal/i);
  });
});

describe("unknownKind", () => {
  it("quotes what was typed and lists every kind", () => {
    const text = unknownKind("bot");
    expect(text).toContain('"bot"');
    for (const kind of KINDS) expect(text).toContain(kind.value);
  });
});

describe("unknownBlueprint", () => {
  it("quotes what was typed and lists what it can build", () => {
    const text = unknownBlueprint("coding");
    expect(text).toContain('"coding"');
    for (const blueprint of BLUEPRINTS) expect(text).toContain(blueprint.value);
  });
});

describe("link", () => {
  it("is clickable where the terminal takes one", () => {
    const text = link(MODELS_URL, "the catalogue", true);
    expect(text).toContain("\u001B]8;;");
    expect(text).toContain(MODELS_URL);
    expect(text).toContain("the catalogue");
  });

  it("is the bare url everywhere else", () => {
    // An escape sequence in a pipe is noise in somebody's log.
    expect(link(MODELS_URL, "the catalogue", false)).toBe(MODELS_URL);
  });
});

describe("otherModelLabel", () => {
  it("points at the catalogue every id comes from", () => {
    expect(otherModelLabel(false)).toContain(MODELS_URL);
  });
});

describe("tree", () => {
  it("shows what would be written, by directory", () => {
    const text = tree("support", projectFiles(specs.full));
    expect(text).toContain("support/");
    expect(text).toContain("src/agents/support/");
    expect(text).toContain("test/");
    expect(text).toContain("wrangler.jsonc");
  });
});

describe("nextSteps", () => {
  it("names each command in the order the project needs them", () => {
    const text = nextSteps("support", "support");
    const order = ["cd support", "keygen", "check", "test", "dev"];
    let at = -1;
    for (const step of order) {
      const found = text.indexOf(step);
      expect(found, step).toBeGreaterThan(at);
      at = found;
    }
  });

  it("says the soul is the part nobody else can write", () => {
    const text = nextSteps("support", "support");
    expect(text).toContain("src/agents/support/soul.ts");
    expect(text).toContain("/a2a");
  });
});

describe("the refusals", () => {
  it("say what to do instead", () => {
    expect(notEmpty("support")).toMatch(/does not exist yet|empty/);
  });
});

describe("finishByHand", () => {
  it("carries the problem and the two commands that finish it", () => {
    const text = finishByHand("support", "npm install failed");
    expect(text).toContain("npm install failed");
    expect(text).toContain("cd support");
    expect(text).toContain("npm install");
    expect(text).toContain("npx wrangler types");
  });
});

describe("notInstalled", () => {
  it("names the agent and does not call it ready", () => {
    // It replaces the success outro, so the one thing it must not do is read
    // like one: nothing in the project runs until the install is finished.
    const text = notInstalled("Support");
    expect(text).toContain("Support");
    expect(text).not.toMatch(/ready/i);
    expect(outroLine("Support")).toMatch(/ready/i);
  });
});
