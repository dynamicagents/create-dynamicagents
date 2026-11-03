import { describe, expect, it } from "vitest";
import { projectFiles } from "./files";
import { variants } from "./fixtures";
import type { AgentSpec } from "./spec";
import { RUNTIME, TRAIN } from "../train";

/**
 * The generated `package.json`, read as a manifest rather than as text.
 *
 * `src/train.ts` is only a set of pins until something writes them out, and
 * `dependenciesFor()` decides which of them a given agent gets. A pin added
 * there and not added here is dead: it reads as a declaration of what a project
 * runs on while every generated manifest leaves it out. That has happened, with
 * `just-bash`, which is why this file exists.
 *
 * Every assertion runs against every fixture, because what varies here is
 * exactly which dependencies a spec earns.
 */

const manifest = (spec: AgentSpec): Record<string, unknown> => {
  const file = projectFiles(spec).find(
    (entry) => entry.path === "package.json"
  );
  return JSON.parse(file!.contents) as Record<string, unknown>;
};

const deps = (spec: AgentSpec): Record<string, string> =>
  manifest(spec).dependencies as Record<string, string>;

describe.each(variants())("$label", ({ spec }) => {
  it("declares every pin the project runs on, at the range the train names", () => {
    // Against `src/train.ts` itself rather than literals: a range that drifts
    // from the pin is the failure this catches, and a literal here would drift
    // with it.
    expect(deps(spec)).toMatchObject({
      "@dynamicagents/core": TRAIN.core,
      "@cloudflare/computer": RUNTIME["@cloudflare/computer"],
      "@cloudflare/think": RUNTIME["@cloudflare/think"],
      agents: RUNTIME.agents,
      ai: RUNTIME.ai,
      "just-bash": RUNTIME["just-bash"],
      "workers-ai-provider": RUNTIME["workers-ai-provider"],
      "@a2a-js/sdk": RUNTIME["@a2a-js/sdk"]
    });
  });

  it("declares `just-bash`, which no import of its own would ever reveal", () => {
    // Think reaches `agents/skills/runner`, which imports it, and both `agents`
    // and `@cloudflare/computer` declare it as an optional peer — so nothing
    // installs it unless a manifest asks. A project that omits it builds only
    // while npm happens to pull a peer nobody named.
    expect(deps(spec)["just-bash"]).toBe(RUNTIME["just-bash"]);
  });

  it("leaves out what the agent has not earned", () => {
    // `dependenciesFor()` is a function of the spec so that an uninstalled
    // capability leaves no dependency behind.
    expect("@dynamicagents/plugins" in deps(spec)).toBe(
      spec.capabilities.length > 0
    );
    expect("zod" in deps(spec)).toBe(spec.subAgent);
  });

  it("keeps both dependency maps sorted, as npm would", () => {
    // npm rewrites an unsorted map on the first install, so an unsorted one
    // here is a diff in the user's first commit that they did not make.
    for (const key of ["dependencies", "devDependencies"] as const) {
      const keys = Object.keys(manifest(spec)[key] as Record<string, string>);
      expect(keys, key).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    }
  });
});
