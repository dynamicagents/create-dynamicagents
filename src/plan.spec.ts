import { describe, expect, it } from "vitest";
import { specs } from "./agent/fixtures.js";
import { DESCRIPTION_MAX, plan, type Target } from "./plan.js";

/**
 * What a run decides before it writes anything.
 *
 * Every refusal here is one somebody will hit, and each has to say what to do
 * instead rather than what went wrong — which is what the assertions check.
 */

const target: Target = { named: "support", dir: "/tmp/support", state: "free" };

const refusal = (...args: Parameters<typeof plan>): string => {
  const result = plan(...args);
  if (result.ok) throw new Error("expected a refusal");
  return result.problem;
};

describe("plan", () => {
  it("plans the whole project when the answers are usable", () => {
    const result = plan(specs.full, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.files.length).toBeGreaterThan(20);
    expect(result.plan.target).toBe(target);
    expect(result.plan.spec).toBe(specs.full);
  });

  it("plans into a directory that exists and is empty", () => {
    // Somebody made it before running this, which is normal.
    expect(plan(specs.full, { ...target, state: "empty" }).ok).toBe(true);
  });

  it("refuses a directory with something in it", () => {
    const problem = refusal(specs.full, { ...target, state: "occupied" });
    expect(problem).toContain("support");
    expect(problem).toMatch(/does not exist yet|empty/);
  });

  it("refuses a tenant id that cannot become a class name", () => {
    expect(refusal({ ...specs.full, tenant: "My Agent" }, target)).toMatch(
      /lowercase/i
    );
  });

  it("refuses a model id that is not one", () => {
    expect(refusal({ ...specs.full, modelId: "gpt-4o" }, target)).toContain(
      "@cf/"
    );
  });

  it("refuses no description, and says what it is for", () => {
    const problem = refusal({ ...specs.full, description: "  " }, target);
    expect(problem).toMatch(/card/);
    expect(problem).toMatch(/soul/);
  });

  it("refuses a description with a line break in it", () => {
    // `--description` is how one arrives. Written out, it reaches a string
    // literal that does not parse and a markdown table that ends early.
    for (const description of [
      'Answers questions\nabout "the handbook"',
      "Answers questions\r\nabout the handbook",
      "Answers questions\u2028about the handbook"
    ]) {
      expect(refusal({ ...specs.full, description }, target)).toMatch(
        /one line/i
      );
    }
  });

  it("refuses a description too long to be one line", () => {
    const description = "a".repeat(DESCRIPTION_MAX + 1);
    expect(refusal({ ...specs.full, description }, target)).toMatch(
      /one line/i
    );
  });

  it("refuses an agent it cannot write", () => {
    const problem = refusal({ ...specs.full, blueprint: "coding" }, target);
    expect(problem).toContain("coding");
    // …and lists what it can.
    expect(problem).toContain("generic");
  });
});
