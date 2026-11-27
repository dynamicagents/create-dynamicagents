import ts from "typescript";
import { describe, expect, it } from "vitest";
import { type GeneratedFile, projectFiles } from "./files";
import { claudeContainerSpecs, specs } from "./fixtures";
import {
  COLLIDES,
  displayName,
  names,
  TENANT_MAX,
  TENANT_MIN,
  TENANT_RE,
  validateModelId,
  validateTenant
} from "./names";

/**
 * The tenant id is the one answer everything else is derived from — the
 * directory, four class names, three bindings, a workflow name and the npm
 * package name — so what it is allowed to be, and what each derivation is, are
 * the two things worth pinning here.
 *
 * The last block is the one that reads the generated project rather than this
 * module: a derived name that collides with something a module already imports
 * is a scaffold that does not parse, and which identifiers those are is a
 * property of the templates, not of a list anybody keeps.
 */

/** A tenant id nothing in the templates uses, so its derivations stand out. */
const SENTINEL = "zebra";

/** One generated module: what the tenant put in its scope, and what was there already. */
interface Scope {
  path: string;
  derived: string[];
  taken: string[];
}

/**
 * Every identifier a module declares at its top level (imported, declared or
 * assigned) in order, repeats included. Parsed with the compiler rather than
 * matched, because an import list in a generated file is laid out by
 * {@link namedFrom} and a regex would read the wrong half of it. `merges` marks
 * an interface or a type alias, which may share a name with a value.
 */
function declarations(
  file: GeneratedFile
): { name: string; merges: boolean }[] {
  const source = ts.createSourceFile(
    file.path,
    file.contents,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );
  const found: { name: string; merges: boolean }[] = [];
  const add = (name: ts.Node | undefined, merges = false): void => {
    if (name !== undefined && ts.isIdentifier(name)) {
      found.push({ name: name.text, merges });
    }
  };
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause === undefined) continue;
      add(clause.name);
      const bindings = clause.namedBindings;
      if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
        add(bindings.name);
      }
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) add(element.name);
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) add(d.name);
    } else if (
      ts.isClassDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      add(statement.name);
    } else if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      add(statement.name, true);
    }
  }
  return found;
}

/**
 * The identifiers a module uses without declaring them anywhere: the globals it
 * reaches, `console` and `crypto` and the like. A top-level name the tenant id
 * produces shadows one of these, which is no duplicate declaration and still a
 * project that does not compile: `console.info` on an imported agent.
 */
function globalsUsed(file: GeneratedFile): string[] {
  const source = ts.createSourceFile(
    file.path,
    file.contents,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );
  const used = new Set<string>();
  const bound = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const parent = node.parent as ts.Node & { name?: ts.Node };
      const named = parent.name === node;
      if (ts.isShorthandPropertyAssignment(parent) || !named) {
        const member =
          (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
          (ts.isQualifiedName(parent) && parent.right === node) ||
          (ts.isImportSpecifier(parent) && parent.propertyName === node) ||
          (ts.isExportSpecifier(parent) && parent.propertyName === node);
        if (!member) used.add(node.text);
      } else {
        bound.add(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...used].filter((name) => !bound.has(name));
}

/** Every identifier a module declares at its top level, once each. */
const declared = (file: GeneratedFile): string[] => [
  ...new Set(declarations(file).map((entry) => entry.name))
];

/** The names a module declares twice: TS2300 in the generated project. */
const twice = (file: GeneratedFile): string[] => {
  const values = declarations(file)
    .filter((entry) => !entry.merges)
    .map((entry) => entry.name);
  return [...new Set(values.filter((name, i) => values.indexOf(name) !== i))];
};

/**
 * Every shape of every blueprint, because the imports differ: `children.ts`
 * only exists with a sub-agent, `plugins.ts` imports a plugin only when one was
 * asked for, and a claude-container project's modules import what a generic
 * one's never do. A shape left out here is a set of tenant ids nobody refuses.
 */
const SHAPES = [
  specs.full,
  specs.bare,
  claudeContainerSpecs.full,
  claudeContainerSpecs.bare
];

/**
 * Every module of every one of {@link SHAPES}, split into the identifiers the
 * tenant id produced and the identifiers that were there whatever the tenant
 * is: declared or imported, or a global the module reaches.
 */
const scopes = (): Scope[] => {
  const result: Scope[] = [];
  for (const shape of SHAPES) {
    const spec = { ...shape, tenant: SENTINEL, name: displayName(SENTINEL) };
    for (const file of projectFiles(spec)) {
      if (!file.path.endsWith(".ts")) continue;
      const ids = declared(file);
      // In any case and with anything around it: `zebraManifest` is as
      // derived as `ZebraAgent` and `ZEBRA_WORKFLOW`.
      const derived = ids.filter((id) => id.toLowerCase().includes(SENTINEL));
      result.push({
        path: file.path,
        derived,
        taken: [...ids, ...globalsUsed(file)].filter(
          (id) => !derived.includes(id)
        )
      });
    }
  }
  return result;
};

/**
 * The words of an identifier, as a tenant id would spell them: `TaskHost` and
 * `TASK_HOST` are both `task`, `host`.
 */
const words = (identifier: string): string[] =>
  (/^[A-Z0-9_]+$/.test(identifier)
    ? identifier.split("_")
    : identifier.split(/(?=[A-Z])/)
  )
    .filter((part) => part !== "")
    .map((part) => part.toLowerCase());

/**
 * The tenant ids worth testing: every run of consecutive words in an
 * identifier the generated modules already have in scope. A derived name is
 * the tenant's words with a prefix or a suffix around them, in one of three
 * cases, so whatever it could land on is one of these runs. Anything a tenant
 * id could not have produced is filtered out by {@link names} not reproducing
 * it.
 */
const candidates = (taken: string[]): string[] => {
  const out = new Set<string>();
  for (const id of taken) {
    const parts = words(id);
    for (let from = 0; from < parts.length; from++) {
      for (let to = from + 1; to <= parts.length; to++) {
        out.add(parts.slice(from, to).join("-"));
      }
    }
  }
  return [...out].filter(
    (tenant) =>
      tenant.length >= TENANT_MIN &&
      tenant.length <= TENANT_MAX &&
      TENANT_RE.test(tenant)
  );
};

/**
 * Every tenant id that would generate a duplicate declaration, and the name it
 * would duplicate.
 *
 * A derived identifier is declared in known modules — the definition's `const`,
 * the four classes, the test Worker's `Test*` ones — so instantiating the
 * sentinel's own derived names against another tenant's and looking for them in
 * the same module's existing scope is the whole hazard, module by module.
 */
const hazards = (): Map<string, string[]> => {
  const s = names(SENTINEL);
  const all = scopes();
  const found = new Map<string, string[]>();
  for (const tenant of candidates(all.flatMap((scope) => scope.taken))) {
    const n = names(tenant);
    for (const scope of all) {
      for (const derived of scope.derived) {
        const instance = derived
          .replace(s.pascal, n.pascal)
          .replace(s.camel, n.camel)
          .replace(s.screaming, n.screaming);
        if (!scope.taken.includes(instance)) continue;
        found.set(tenant, [
          ...new Set([...(found.get(tenant) ?? []), instance])
        ]);
      }
    }
  }
  return found;
};

describe("names", () => {
  it("derives every name a one-word tenant spells", () => {
    expect(names("support")).toEqual({
      tenant: "support",
      pascal: "Support",
      camel: "support",
      screaming: "SUPPORT",
      dir: "src/agents/support",
      hostClass: "SupportHost",
      workflowClass: "SupportWorkflow",
      agentClass: "SupportAgent",
      childClass: "SupportChild",
      workflowBinding: "SUPPORT_WORKFLOW",
      workflowName: "support-workflow"
    });
  });

  it("derives every name a multi-word tenant spells", () => {
    // The case that goes wrong: a dash means something different in a class
    // name, a binding, a workflow name and a directory.
    expect(names("release-notes")).toEqual({
      tenant: "release-notes",
      pascal: "ReleaseNotes",
      camel: "releaseNotes",
      screaming: "RELEASE_NOTES",
      dir: "src/agents/release-notes",
      hostClass: "ReleaseNotesHost",
      workflowClass: "ReleaseNotesWorkflow",
      agentClass: "ReleaseNotesAgent",
      childClass: "ReleaseNotesChild",
      workflowBinding: "RELEASE_NOTES_WORKFLOW",
      workflowName: "release-notes-workflow"
    });
  });
});

describe("displayName", () => {
  it("reads as a name on a card", () => {
    expect(displayName("release-notes")).toBe("Release Notes");
  });
});

describe("validateTenant", () => {
  it("accepts what every derivation above can carry", () => {
    for (const value of ["support", "release-notes", "a1", "x2-y3-z4"]) {
      expect(validateTenant(value), value).toBeUndefined();
    }
  });

  it("refuses what a class name, a binding or a directory could not be", () => {
    for (const value of [
      "",
      "a",
      "Support",
      "my_agent",
      "-leading",
      "trailing-",
      "double--dash",
      "1first",
      "with space",
      "a".repeat(TENANT_MAX + 1)
    ]) {
      expect(validateTenant(value), value).toBeTypeOf("string");
    }
  });

  it("refuses a name the generated classes already use", () => {
    // `run` would become a field on the pipeline beside core's own `run()`:
    // a type error in the generated project, far from the prompt that caused it.
    expect(validateTenant("run")).toContain("run");
    expect(validateTenant("pipeline")).toBeTypeOf("string");
  });

  it("refuses a name JavaScript would not let the project declare", () => {
    // `export const class = defineAgent(…)` does not parse, and a class field
    // may not be called `constructor`: a syntax error in a file nobody wrote.
    for (const value of [
      "class",
      "await",
      "constructor",
      "function",
      "do",
      "in",
      "static",
      "eval"
    ]) {
      expect(validateTenant(value), value).toBeTypeOf("string");
    }
    expect(validateTenant("class")).toContain("class");
  });

  it("accepts a multi-word id that starts with a reserved word", () => {
    // Only a one-word id can collide: `classify` and `class-notes` camelCase
    // to identifiers of their own.
    for (const value of ["class-notes", "classify", "do-it", "news"]) {
      expect(validateTenant(value), value).toBeUndefined();
    }
  });

  it("says what to type instead", () => {
    expect(validateTenant("My Agent")).toMatch(/lowercase/i);
  });
});

describe("a tenant id the generated code already uses", () => {
  it("refuses the two the templates make plainest", () => {
    // `src/index.ts` imports the definition as `a2a` and then writes
    // `const a2a = createA2AWorker(…)`; `host.ts` writes `class TaskHost
    // extends TaskHost`. Neither project parses, and both ids look harmless.
    expect(validateTenant("a2a")).toContain("a2a");
    expect(validateTenant("task")).toContain("TaskHost");
  });

  it("refuses every id a generated module scope rules out", () => {
    // Read off the generated project, so a template that imports something new
    // fails here rather than in somebody's first scaffold.
    const found = hazards();
    expect(found.size).toBeGreaterThan(5);
    for (const [tenant, collisions] of found) {
      const problem = validateTenant(tenant);
      expect(problem, tenant).toBeTypeOf("string");
      expect(collisions, `${tenant} → ${COLLIDES.get(tenant)}`).toContain(
        COLLIDES.get(tenant)
      );
    }
  });

  it("refuses nothing the scopes no longer rule out", () => {
    // The other direction: an entry left behind after a template stopped
    // importing something is an id refused for nothing.
    expect([...COLLIDES.keys()].sort()).toEqual([...hazards().keys()].sort());
  });

  it("writes a project that declares each name once, for every id it accepts", () => {
    // The scans above reason through the derivations; this one does not. It
    // writes every shape for every candidate the validator lets through and
    // looks for a module declaring one name twice, so a derivation nobody
    // modelled is caught here rather than in somebody's first scaffold.
    const accepted = candidates(
      scopes().flatMap((scope) => scope.taken)
    ).filter((tenant) => validateTenant(tenant) === undefined);
    const found: string[] = [];
    for (const tenant of accepted) {
      for (const shape of SHAPES) {
        const spec = { ...shape, tenant, name: displayName(tenant) };
        for (const file of projectFiles(spec)) {
          if (!file.path.endsWith(".ts")) continue;
          for (const name of twice(file)) {
            found.push(`${tenant}: ${file.path} declares ${name} twice`);
          }
        }
      }
    }
    expect([...new Set(found)]).toEqual([]);
  });

  it("leaves alone what only looks taken", () => {
    // `browser` is imported in `plugins.ts` and `worker` in the specs, but
    // neither module declares a name derived from the tenant, so neither id
    // can collide. Refusing them would be a question asked for nothing.
    for (const tenant of ["browser", "worker", "artifacts", "sub"]) {
      expect(validateTenant(tenant), tenant).toBeUndefined();
    }
  });
});

describe("validateModelId", () => {
  it("accepts an id from the catalogue", () => {
    expect(validateModelId("@cf/zai-org/glm-5.3-flash")).toBeUndefined();
    expect(validateModelId("@cf/meta/llama-3.3-70b-instruct")).toBeUndefined();
  });

  it("refuses anything that is not one", () => {
    for (const value of ["", "glm-5.3", "@cf/only-one-part", "gpt-4o"]) {
      expect(validateModelId(value), value).toBeTypeOf("string");
    }
  });

  it("says what one looks like", () => {
    expect(validateModelId("llama")).toContain("@cf/");
  });
});
