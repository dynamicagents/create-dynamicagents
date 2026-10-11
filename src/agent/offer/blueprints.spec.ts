import { describe, expect, it } from "vitest";
import { BLUEPRINTS, blueprintOf } from "./blueprints.js";

describe("BLUEPRINTS", () => {
  it("offers the generic agent", () => {
    expect(BLUEPRINTS.map((blueprint) => blueprint.value)).toEqual(["generic"]);
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
