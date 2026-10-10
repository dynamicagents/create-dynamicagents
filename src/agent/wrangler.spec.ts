import { describe, expect, it } from "vitest";
import { projectFiles } from "./files.js";
import { specs, variants } from "./fixtures.js";
import { names } from "./names.js";

/**
 * The generated `wrangler.jsonc`, read as configuration rather than as text.
 *
 * It is the one generated file with comments in it, which is also what makes it
 * worth parsing in a spec: a comment carrying a stray quote or a trailing comma
 * left behind by an edit is a deploy that fails on something nobody can see by
 * reading the diff.
 */

/** JSONC, minus the comments. Enough for a file this CLI wrote itself. */
function parse(source: string): unknown {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < source.length) {
    const char = source[i]!;
    if (inString) {
      out += char;
      if (char === "\\") {
        out += source[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (char === '"') inString = false;
      i += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      i += 1;
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    out += char;
    i += 1;
  }
  return JSON.parse(out);
}

interface Wrangler {
  name: string;
  main: string;
  compatibility_date: string;
  compatibility_flags: string[];
  workers_dev: boolean;
  ai: { binding: string };
  browser?: { binding: string };
  durable_objects: { bindings: { class_name: string; name: string }[] };
  migrations: { tag: string; new_sqlite_classes: string[] }[];
  workflows: { name: string; binding: string; class_name: string }[];
  secrets: { required: string[] };
}

const config = (tenant: keyof typeof specs): Wrangler => {
  const spec = specs[tenant];
  const file = projectFiles(spec).find(
    (entry) => entry.path === "wrangler.jsonc"
  );
  return parse(file!.contents) as Wrangler;
};

describe.each(variants())("$label", ({ spec }) => {
  it("parses, comments and all", () => {
    const parsed = parse(
      projectFiles(spec).find((file) => file.path === "wrangler.jsonc")!
        .contents
    );
    expect(parsed).toBeTypeOf("object");
  });
});

describe("the deployment it configures", () => {
  const wrangler = config("full");
  const n = names(specs.full.tenant);

  it("is named for the tenant, and points at the Worker entry", () => {
    expect(wrangler.name).toBe(specs.full.tenant);
    expect(wrangler.main).toBe("src/index.ts");
    expect(wrangler.compatibility_flags).toContain("nodejs_compat");
    expect(wrangler.compatibility_date).toBe(specs.full.compatibilityDate);
  });

  it("serves one origin to start on", () => {
    // Core derives the card's url, its `jku` and the token audience from the
    // request origin, so a deployment has to settle on one. `workers_dev` is
    // the one it has before it has a domain.
    expect(wrangler.workers_dev).toBe(true);
  });

  it("binds what core requires and nothing it does not", () => {
    expect(wrangler.ai.binding).toBe("AI");
    const bound = wrangler.durable_objects.bindings.map(
      (binding) => binding.name
    );
    expect(bound).toEqual([n.hostClass, n.agentClass, "ARTIFACTS"]);
    expect(wrangler.secrets.required).toEqual([
      "A2A_SIGNING_KEY",
      "GATEKEEPER_ORIGINS"
    ]);
  });

  it("creates every bound class in its first and only tag", () => {
    expect(wrangler.migrations).toHaveLength(1);
    const [first] = wrangler.migrations;
    expect(first!.tag).toBe("v1");
    expect(first!.new_sqlite_classes).toEqual([
      n.hostClass,
      n.agentClass,
      "Artifacts"
    ]);
  });

  it("names the workflow after the tenant, not after the Worker", () => {
    // A merge into another Worker must not rename it: a renamed workflow
    // abandons every instance still running under the old name.
    expect(wrangler.workflows).toEqual([
      {
        name: n.workflowName,
        binding: n.workflowBinding,
        class_name: n.workflowClass
      }
    ]);
  });

  it("binds the browser only where it is installed", () => {
    expect(wrangler.browser?.binding).toBe("BROWSER");
    expect(config("bare").browser).toBeUndefined();
  });
});
