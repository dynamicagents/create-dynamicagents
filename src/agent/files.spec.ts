import { describe, expect, it } from "vitest";
import { projectFiles, type GeneratedFile } from "./files.js";
import { specs, variants } from "./fixtures.js";
import { names } from "./names.js";

/**
 * What a generated project consists of, and the wiring that has to agree with
 * itself across files.
 *
 * Most of what could go wrong in a template is caught by the generated
 * project's own suite, which CI runs — this holds the things that are *between*
 * files, where nothing in the project itself would notice: a host naming a
 * workflow binding that `wrangler.jsonc` does not declare, a card advertising
 * a capability that is not installed, a migration tag missing a class that is
 * bound.
 */

const at = (files: GeneratedFile[], path: string): string => {
  const file = files.find((entry) => entry.path === path);
  if (file === undefined) throw new Error(`${path} was not generated`);
  return file.contents;
};

describe.each(variants())("$label", ({ spec }) => {
  const files = projectFiles(spec);
  const n = names(spec.tenant);
  const paths = files.map((file) => file.path);

  it("writes a complete project", () => {
    for (const path of [
      "package.json",
      "wrangler.jsonc",
      "tsconfig.json",
      "vitest.config.ts",
      "eslint.config.js",
      "README.md",
      "AGENTS.md",
      ".env.example",
      ".gitignore",
      "src/index.ts",
      "src/host-manifest.ts",
      "src/copy.ts",
      "src/model.ts",
      `${n.dir}/definition.ts`,
      `${n.dir}/host.ts`,
      `${n.dir}/workflow.ts`,
      `${n.dir}/agent.ts`,
      `${n.dir}/manifest.ts`,
      `${n.dir}/plugins.ts`,
      `${n.dir}/soul.ts`,
      `${n.dir}/tuning.ts`,
      "test/worker.ts",
      "test/turn.spec.ts",
      "test/edge.spec.ts"
    ]) {
      expect(paths, path).toContain(path);
    }
  });

  it("writes one file per path, and nothing empty", () => {
    expect(new Set(paths).size).toBe(paths.length);
    for (const file of files) expect(file.contents, file.path).not.toBe("");
  });

  it("ends every file with exactly one newline", () => {
    for (const file of files) {
      expect(file.contents.endsWith("\n"), file.path).toBe(true);
      expect(file.contents.endsWith("\n\n"), file.path).toBe(false);
    }
  });

  it("nests the agent under src/agents/<tenant>/", () => {
    // Kept even with one agent: a flatter layout would turn a later merge into
    // another Worker into a rename of every file. See ./merge-notes.ts.
    expect(n.dir).toBe(`src/agents/${spec.tenant}`);
    expect(paths.some((path) => path.startsWith(`${n.dir}/`))).toBe(true);
  });

  it("binds every class it exports, and creates it in the first tag", () => {
    const wrangler = at(files, "wrangler.jsonc");
    const index = at(files, "src/index.ts");
    for (const className of [n.hostClass, n.agentClass]) {
      expect(index, className).toContain(`export { ${className} }`);
      expect(wrangler, className).toContain(`"class_name": "${className}"`);
      expect(wrangler, className).toContain(`"${className}"`);
    }
    // The pipeline is a Workflow, not a Durable Object: bound, exported, and
    // deliberately absent from the migration.
    expect(index).toContain(`export { ${n.workflowClass} }`);
    expect(wrangler).toContain(`"class_name": "${n.workflowClass}"`);
    const migration = wrangler.slice(
      wrangler.indexOf('"migrations"'),
      wrangler.indexOf('"workflows"')
    );
    expect(migration).not.toContain(n.workflowClass);
  });

  it("names the same bindings in the host, the pipeline and wrangler", () => {
    const wrangler = at(files, "wrangler.jsonc");
    // A host reaches its pipeline by binding name, and a pipeline its step
    // agent the same way. A mismatch is a task that never starts.
    expect(at(files, `${n.dir}/host.ts`)).toContain(`"${n.workflowBinding}"`);
    expect(wrangler).toContain(`"binding": "${n.workflowBinding}"`);
    expect(at(files, `${n.dir}/host.ts`)).toContain(`"${n.hostClass}"`);
    expect(at(files, `${n.dir}/workflow.ts`)).toContain(`"${n.agentClass}"`);
  });

  it("wires ARTIFACTS all three ways core requires", () => {
    // A binding, an export and the route delegation in front of the A2A
    // handler. An agent that starts without all of them throws.
    expect(at(files, "wrangler.jsonc")).toContain('"name": "ARTIFACTS"');
    expect(at(files, "src/index.ts")).toContain("export { Artifacts }");
    expect(at(files, "src/index.ts")).toContain(
      "(await handleArtifactRoute(request, env)) ?? a2a(request, env)"
    );
    expect(at(files, "wrangler.jsonc")).toContain('"Artifacts"');
  });

  it("asks for exactly the secrets core requires", () => {
    const wrangler = at(files, "wrangler.jsonc");
    expect(wrangler).toContain("A2A_SIGNING_KEY");
    expect(wrangler).toContain("GATEKEEPER_ORIGINS");
    expect(at(files, ".env.example")).toContain("A2A_SIGNING_KEY=");
    // No model credential anywhere: Workers AI is reached through `AI`.
    expect(wrangler).not.toContain("API_KEY");
    expect(wrangler).toContain('"binding": "AI"');
  });

  it("mounts the tenant and names it on the stub card", () => {
    expect(at(files, "src/index.ts")).toContain(`agents: [${n.camel}]`);
    expect(at(files, `${n.dir}/definition.ts`)).toContain(
      `tenant: "${spec.tenant}"`
    );
    expect(at(files, "src/host-manifest.ts")).toContain(spec.tenant);
  });

  it("keeps the shared files free of this agent's name", () => {
    // What makes a merge of two generated projects have nothing to reconcile:
    // everything outside the agent's directory is the same in both.
    for (const path of ["src/copy.ts", "src/model.ts", "tsconfig.json"]) {
      expect(at(files, path), path).not.toContain(spec.tenant);
      expect(at(files, path), path).not.toContain(n.pascal);
    }
  });

  it("says nothing about bundle isolation", () => {
    // One agent per Worker makes the bundle the agent: there is no sibling to
    // keep out of it, so the idea has no place in a generated project.
    for (const file of files) {
      expect(file.contents.toLowerCase(), file.path).not.toContain("isolation");
    }
    expect(paths).not.toContain("scripts/verify-isolation.mjs");
  });

  it("ships AGENTS.md and no CLAUDE.md", () => {
    // Current Claude versions read AGENTS.md when there is no CLAUDE.md, so a
    // second file would only be a pointer that can rot.
    expect(paths).toContain("AGENTS.md");
    expect(paths).not.toContain("CLAUDE.md");
  });

  it("tells the suite where the test-only classes are bound", () => {
    const vitest = at(files, "vitest.config.ts");
    const worker = at(files, "test/worker.ts");
    for (const binding of [
      `TEST_${n.screaming}_HOST`,
      `TEST_${n.screaming}_AGENT`,
      `TEST_${n.workflowBinding}`
    ]) {
      expect(vitest, binding).toContain(binding);
      expect(worker, binding).toContain(binding);
    }
  });
});

describe("the sub-agent", () => {
  it("brings its file, its class and its skill when it is wanted", () => {
    const spec = specs.full;
    const n = names(spec.tenant);
    const files = projectFiles(spec);
    expect(files.map((file) => file.path)).toContain(`${n.dir}/children.ts`);
    expect(at(files, `${n.dir}/agent.ts`)).toContain("getSubAgents");
    expect(at(files, `${n.dir}/manifest.ts`)).toContain('id: "delegate"');
    expect(at(files, "test/turn.spec.ts")).toContain("delegate:");
    // Its schema is zod's, so the project has to declare it.
    expect(at(files, "package.json")).toContain('"zod"');
  });

  it("leaves nothing behind when it is not", () => {
    const spec = specs.bare;
    const n = names(spec.tenant);
    const files = projectFiles(spec);
    const paths = files.map((file) => file.path);
    expect(paths).not.toContain(`${n.dir}/children.ts`);
    expect(at(files, `${n.dir}/agent.ts`)).not.toContain("getSubAgents");
    expect(at(files, `${n.dir}/manifest.ts`)).not.toContain('id: "delegate"');
    expect(at(files, "src/index.ts")).not.toContain(n.childClass);
    expect(at(files, "vitest.config.ts")).not.toContain("CHILD");
    // Nothing imports zod any more, so nothing should depend on it.
    expect(at(files, "package.json")).not.toContain('"zod"');
  });
});

describe("a capability", () => {
  const spec = specs.full;
  const n = names(spec.tenant);
  const files = projectFiles(spec);

  it("arrives whole: the plugin, its binding and its skill", () => {
    // A plugin declares the bindings it needs and core checks them at start, so
    // any one of these three alone is an agent that throws on its first
    // request, or a card that lies.
    expect(at(files, `${n.dir}/plugins.ts`)).toContain(
      "@dynamicagents/plugins/browser"
    );
    expect(at(files, "wrangler.jsonc")).toContain('"binding": "BROWSER"');
    expect(at(files, `${n.dir}/manifest.ts`)).toContain('id: "browse"');
    expect(at(files, "package.json")).toContain('"@dynamicagents/plugins"');
  });

  it("leaves no trace but a comment when it is not installed", () => {
    const bare = projectFiles(specs.bare);
    expect(at(bare, "wrangler.jsonc")).not.toContain('"binding": "BROWSER"');
    expect(
      at(bare, `${names(specs.bare.tenant).dir}/manifest.ts`)
    ).not.toContain('id: "browse"');
    expect(at(bare, "package.json")).not.toContain('"@dynamicagents/plugins"');
    // The example stays, as a comment, beside the reason.
    expect(at(bare, `${names(specs.bare.tenant).dir}/plugins.ts`)).toContain(
      "browser"
    );
  });
});

describe("the model", () => {
  it("is the one that was chosen, for the turn and for compaction", () => {
    const spec = { ...specs.full, modelId: "@cf/meta/llama-3.3-70b-instruct" };
    const files = projectFiles(spec);
    const tuning = at(files, `${names(spec.tenant).dir}/tuning.ts`);
    expect(tuning).toContain('modelId: "@cf/meta/llama-3.3-70b-instruct"');
    expect(tuning).toContain(
      'compactionModelId: "@cf/meta/llama-3.3-70b-instruct"'
    );
  });
});
