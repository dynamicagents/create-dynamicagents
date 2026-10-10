import { describe, expect, it } from "vitest";
import {
  displayName,
  names,
  TENANT_MAX,
  validateModelId,
  validateTenant
} from "./names.js";

/**
 * The tenant id is the one answer everything else is derived from — the
 * directory, four class names, three bindings, a workflow name and the npm
 * package name — so what it is allowed to be, and what each derivation is, are
 * the two things worth pinning here.
 */

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
