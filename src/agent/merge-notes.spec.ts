import { describe, expect, it } from "vitest";
import { projectFiles } from "./files.js";
import { specs } from "./fixtures.js";
import { MERGE_CAVEAT, mergeSteps } from "./merge-notes.js";
import { names } from "./names.js";

/**
 * The merge recipe, held to the project it describes.
 *
 * The creator makes one agent per Worker; bringing a second one in later is a
 * documented procedure rather than a tool, so the risk is that the procedure
 * goes stale — a template grows a wiring point and the recipe does not mention
 * it. The last assertion here is the one that catches that: it reads what the
 * templates actually wire and requires the recipe to name each file.
 */

const n = names(specs.full.tenant);

describe("mergeSteps", () => {
  it("starts with the directory that holds the agent", () => {
    expect(mergeSteps(n.dir)[0]!.path).toBe(`${n.dir}/`);
  });

  it("says what to do with each file, as one sentence", () => {
    for (const step of mergeSteps(n.dir)) {
      expect(step.what, step.path).not.toBe("");
      expect(step.what.trim().endsWith("."), step.path).toBe(true);
    }
  });

  it("names every file outside the agent's directory that is wired to it", () => {
    // Derived from what the templates write, not from a list kept by hand: a
    // new wiring point fails here until the recipe mentions it.
    const mentioned = mergeSteps(n.dir).map((step) => step.path);
    const wired = projectFiles(specs.full)
      .map((file) => file.path)
      .filter(
        (path) =>
          !path.startsWith(`${n.dir}/`) &&
          (path === "src/index.ts" ||
            path === "src/host-manifest.ts" ||
            path === "wrangler.jsonc" ||
            path === "package.json" ||
            path === ".env.example" ||
            path === "vitest.config.ts" ||
            path.startsWith("test/"))
      );
    for (const path of wired) {
      const covered = mentioned.some(
        (entry) => entry === path || path.startsWith(entry)
      );
      expect(covered, `${path} is not in the merge recipe`).toBe(true);
    }
  });

  it("says a merge does not move state", () => {
    // Nothing in the code hints at it: a Durable Object belongs to the script
    // that declares its class, so the arriving agent starts empty.
    expect(MERGE_CAVEAT).toMatch(/does not move state/i);
  });
});

describe("the generated AGENTS.md", () => {
  const agents = projectFiles(specs.full).find(
    (file) => file.path === "AGENTS.md"
  )!.contents;

  it("carries the recipe, because that is the file the merger reads", () => {
    for (const step of mergeSteps(n.dir)) {
      expect(agents, step.path).toContain(step.path);
    }
    expect(agents).toContain(MERGE_CAVEAT);
  });
});
