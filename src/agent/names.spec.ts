import ts from "typescript";
import { describe, expect, it } from "vitest";
import { type GeneratedFile, projectFiles } from "./files.js";
import { specs } from "./fixtures.js";
import {
  COLLIDES,
  displayName,
  names,
  TENANT_MAX,
  TENANT_MIN,
  TENANT_RE,
  validateModelId,
  validateTenant
} from "./names.js";

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
 * Every identifier a module declares at its top level — imported, declared or
 * assigned. Parsed with the compiler rather than matched, because an import
 * list in a generated file is laid out by {@link namedFrom} and a regex would
 * read the wrong half of it.
 */
function declared(file: GeneratedFile): string[] {
  const source = ts.createSourceFile(
    file.path,
    file.contents,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );
  const found = new Set<string>();
  const add = (name: ts.Node | undefined): void => {
    if (name !== undefined && ts.isIdentifier(name)) found.add(name.text);
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
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      add(statement.name);
    }
  }
  return [...found];
}

/**
 * Every module of a generated project, split into the identifiers the tenant id
 * produced and the identifiers that were there whatever the tenant is.
 *
 * Both shapes, because the imports differ: `children.ts` only exists with a
 * sub-agent, and `plugins.ts` imports a plugin only when one was asked for.
 */
const scopes = (): Scope[] => {
  const s = names(SENTINEL);
  const result: Scope[] = [];
  for (const shape of [specs.full, specs.bare]) {
    const spec = { ...shape, tenant: SENTINEL, name: displayName(SENTINEL) };
    for (const file of projectFiles(spec)) {
      if (!file.path.endsWith(".ts")) continue;
      const ids = declared(file);
      const derived = ids.filter(
        (id) => id.includes(s.pascal) || id === s.camel
      );
      result.push({
        path: file.path,
        derived,
        taken: ids.filter((id) => !derived.includes(id))
      });
    }
  }
  return result;
};

/** `TaskHost` → `task-host`, and `TaskHost` without `Host` → `task`. */
const kebab = (identifier: string): string =>
  identifier
    .split(/(?=[A-Z])/)
    .filter((part) => part !== "")
    .join("-")
    .toLowerCase();

const SUFFIXES = ["Host", "Workflow", "Agent", "Child"];

/**
 * The tenant ids worth testing: every identifier the generated modules already
 * have in scope, read backwards through the derivations — as a camelCase name,
 * and as a class name with its suffix removed. Anything a tenant id could not
 * have produced is filtered out by {@link names} not reproducing it.
 */
const candidates = (taken: string[]): string[] => {
  const out = new Set<string>();
  for (const id of taken) {
    out.add(kebab(id));
    for (const suffix of SUFFIXES) {
      if (id.endsWith(suffix)) out.add(kebab(id.slice(0, -suffix.length)));
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
          .replace(s.camel, n.camel);
        if (!scope.taken.includes(instance)) continue;
        found.set(tenant, [...(found.get(tenant) ?? []), instance]);
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
