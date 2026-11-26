import { describe, expect, it } from "vitest";
import { BLUEPRINTS, blueprintOf } from "./blueprints";

describe("BLUEPRINTS", () => {
  it("offers the generic agent first, then claude-container", () => {
    expect(BLUEPRINTS.map((blueprint) => blueprint.value)).toEqual([
      "generic",
      "claude-container"
    ]);
  });

  it("gives a blueprint written as it stands an identity of its own", () => {
    // A blueprint with an agent of its own has a name of its own, and a
    // default for its tenant and description is what lets `--yes` alone write it.
    for (const blueprint of BLUEPRINTS.filter((entry) => entry.defaults)) {
      expect(blueprint.defaults?.tenant, blueprint.value).toBe(blueprint.value);
      expect(blueprint.defaults?.description, blueprint.value).not.toBe("");
    }
  });

  it("gives every entry a label, a hint and what it is", () => {
    for (const blueprint of BLUEPRINTS) {
      expect(blueprint.label).not.toBe("");
      expect(blueprint.hint).not.toBe("");
      expect(blueprint.about).not.toBe("");
    }
  });

  it("offers nothing it cannot build", () => {
    // A menu entry for an agent this CLI cannot write would answer with an
    // apology. The coders arrive here when they arrive.
    expect(BLUEPRINTS.map((blueprint) => blueprint.value)).not.toContain(
      "coding"
    );
  });
});

describe("blueprintOf", () => {
  it("finds a blueprint whatever its case", () => {
    expect(blueprintOf("Generic")?.value).toBe("generic");
  });

  it("finds nothing for what is not one", () => {
    expect(blueprintOf("coding")).toBeUndefined();
  });
});
