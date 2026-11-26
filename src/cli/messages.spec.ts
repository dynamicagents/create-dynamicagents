import { readdirSync, readFileSync } from "node:fs";
import * as ts from "typescript";
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
  nextStepsContainer,
  otherModelLabel,
  NEXT_STEPS,
  OUTRO,
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
 * Every module the bin is bundled from, parsed. No spec is one of them.
 *
 * Parsed rather than matched, because the question below is about identifiers
 * and this package's messages are strings full of the words it would match: the
 * parse is what makes `"--help, -h"` text and `help` a name. The compiler is
 * already a devDependency, and `npm run check` runs it over this file anyway.
 */
const modules = (): { path: string; source: ts.SourceFile }[] => {
  const src = new URL("../", import.meta.url);
  return readdirSync(src, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".spec.ts"))
    .map((path) => ({
      path,
      source: ts.createSourceFile(
        path,
        readFileSync(new URL(path, src), "utf8"),
        ts.ScriptTarget.ESNext,
        // Parents, which `reference` reads to tell a name from a property.
        true
      )
    }));
};

/** Every node under one, the subject included. */
const walk = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

/** `./messages` however a module reaches it, and nothing else called that. */
const isMessages = (specifier: string): boolean =>
  /(^|\/)messages$/.test(specifier);

/**
 * Which messages a module reads: every name it takes out of `./messages`, and
 * every property it reads off a namespace import of it, under whatever name it
 * imported that as.
 *
 * A module that reached the messages some third way would read as reading none
 * of them, so the spec below would fail rather than pass quietly. That is the
 * direction to fail in for a check nothing else backs up.
 */
const reads = (source: ts.SourceFile): string[] => {
  const named: string[] = [];
  const namespaces = new Set<string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!isMessages(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
      continue;
    }
    for (const element of bindings.elements) {
      named.push((element.propertyName ?? element.name).text);
    }
  }

  walk(source, (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      namespaces.has(node.expression.text)
    ) {
      named.push(node.name.text);
    }
  });

  return named;
};

/** Every message a module exports: a const or a function, never a type. */
const exported = (source: ts.SourceFile): string[] => {
  const found: string[] = [];

  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const isExported = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    );
    if (isExported !== true) continue;

    if (ts.isVariableStatement(statement)) {
      for (const declared of statement.declarationList.declarations) {
        if (ts.isIdentifier(declared.name)) found.push(declared.name.text);
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      found.push(statement.name.text);
    }
  }

  return found;
};

/**
 * Whether an identifier uses a binding, rather than being a name something else
 * owns: a property (`flag.help`, `{ help: … }`, an interface member) says
 * nothing about the message called `help`, and the name a declaration or an
 * import introduces is where a binding starts rather than a use of it.
 */
const use = (identifier: ts.Identifier): boolean => {
  const parent = identifier.parent;
  const owned =
    (ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isBindingElement(parent)) &&
    parent.name === identifier;
  return (
    !owned && !ts.isImportSpecifier(parent) && !ts.isNamespaceImport(parent)
  );
};

/**
 * Every binding a module uses, as code: not a comment, not literal text.
 *
 * By name, not by resolved symbol, which is the one thing this does not
 * promise: a local or a parameter called the same as a message would read as a
 * use of it. That direction loses a finding rather than inventing one, and
 * resolving every identifier means building a program and a checker in a spec.
 */
const uses = (source: ts.SourceFile): Set<string> => {
  const found = new Set<string>();
  walk(source, (node) => {
    if (ts.isIdentifier(node) && use(node)) found.add(node.text);
  });
  return found;
};

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

    const said = new Set(
      all
        .filter((module) => module.path !== SUBJECT)
        .flatMap((module) => reads(module.source))
    );
    // Nobody says it, so the one thing left that saves a message is another
    // message here using it: a use is never the declaration it belongs to.
    const here = uses(own!.source);

    const unread = exported(own!.source).filter(
      (name) => !said.has(name) && !here.has(name)
    );

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

  it("ends with the format every install runs, after the install", () => {
    const text = finishByHand("support", "npm install failed");
    expect(text.indexOf("npm run format")).toBeGreaterThan(
      text.indexOf("npm install")
    );
  });
});

describe("nextStepsContainer", () => {
  it("says what only the operator can supply, and the tenant to register", () => {
    const text = nextStepsContainer("coordinator", "pr-bot");
    expect(text).toContain("cd coordinator");
    expect(text).toContain(".env.example");
    expect(text).toContain("bucket");
    expect(text).toContain("`pr-bot`");
    // Its soul is written already, so it is not handed back as homework.
    expect(text).not.toContain("soul.ts");
    // It works on no repository, so it asks for no GitHub token.
    expect(text).not.toContain("GitHub");
  });
});

describe("notInstalled", () => {
  it("names the agent and does not call it ready", () => {
    // It replaces the success outro, so the one thing it must not do is read
    // like one: nothing in the project runs until the install is finished.
    const text = notInstalled("Support");
    expect(text).toContain("Support");
    expect(text).not.toMatch(/ready/i);
    expect(OUTRO.generic?.("Support")).toMatch(/ready/i);
  });
});

describe("what comes after the install, per blueprint", () => {
  it("has next steps and an outro for every blueprint the menu offers", () => {
    for (const blueprint of BLUEPRINTS) {
      expect(NEXT_STEPS[blueprint.value], blueprint.value).toBeDefined();
      expect(OUTRO[blueprint.value], blueprint.value).toBeDefined();
    }
  });
});
