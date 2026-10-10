import { describe, expect, it } from "vitest";
import { projectFiles } from "./files.js";
import { specs } from "./fixtures.js";
import { MERGE_CAVEAT, mergeSteps } from "./merge-notes.js";
import { names } from "./names.js";
import type { AgentSpec } from "./spec.js";

/**
 * The merge recipe, held to the project it describes.
 *
 * The creator makes one agent per Worker; bringing a second one in later is a
 * documented procedure rather than a tool, so the risk is that the procedure
 * goes stale — a template grows a wiring point and the recipe does not mention
 * it. {@link wiring} is what catches that, and it is derived from the templates
 * themselves rather than from a list kept beside them.
 */

const n = names(specs.full.tenant);

/** Everything outside the agent's own directory, by path. */
const outside = (spec: AgentSpec): Map<string, string> => {
  const dir = `${names(spec.tenant).dir}/`;
  return new Map(
    projectFiles(spec)
      .filter((file) => !file.path.startsWith(dir))
      .map((file) => [file.path, file.contents])
  );
};

/**
 * Every file a merge has to touch, derived: those outside the agent's own
 * directory whose contents are not the same in two different generated
 * projects.
 *
 * Two comparisons, because a file can vary in two ways. `multiWord` is a
 * different tenant id, which catches everything derived from it — a class
 * export, a binding, a name on a card. `bare` is the same id with different
 * answers, which catches the option-dependent ones, the capability bindings
 * included. Anything identical across both is a support file that a merge can
 * leave alone.
 */
const wiring = (): string[] => {
  const base = outside(specs.full);
  const differs = new Set<string>();
  for (const other of [outside(specs.multiWord), outside(specs.bare)]) {
    for (const [path, contents] of base) {
      if (other.get(path) !== contents) differs.add(path);
    }
    for (const path of other.keys()) if (!base.has(path)) differs.add(path);
  }
  return [...differs].sort();
};

const covered = (path: string): boolean =>
  mergeSteps(n.dir).some(
    (step) => step.path === path || path.startsWith(step.path)
  );

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
    // Derived rather than listed: a file outside the agent's directory whose
    // contents depend on the tenant id or on an answer is wiring by
    // definition, so a template that grows one fails here until a step names
    // it. No allowlist to forget to extend.
    for (const path of wiring()) {
      expect(covered(path), `${path} is not in the merge recipe`).toBe(true);
    }
  });

  it("names nothing a merge would not have to touch", () => {
    // The other direction: a step for a file that is the same in every
    // generated project is a step somebody follows for no reason, and a step
    // for a file no longer written is a recipe that has gone stale.
    const wired = wiring();
    for (const step of mergeSteps(n.dir)) {
      if (step.path === `${n.dir}/`) continue;
      const real = wired.some(
        (path) => path === step.path || path.startsWith(step.path)
      );
      expect(real, `${step.path} is in the recipe but carries no wiring`).toBe(
        true
      );
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
