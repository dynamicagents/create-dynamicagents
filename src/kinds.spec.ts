import { describe, expect, it } from "vitest";
import { KINDS, kindOf } from "./kinds.js";

describe("KINDS", () => {
  it("offers a gate, a leader and an agent, in that order", () => {
    expect(KINDS.map((kind) => kind.value)).toEqual([
      "gate",
      "leader",
      "agent"
    ]);
  });

  it("gives every kind a label, a hint and what it is", () => {
    for (const kind of KINDS) {
      expect(kind.label).not.toBe("");
      expect(kind.hint).not.toBe("");
      expect(kind.about).not.toBe("");
    }
  });
});

describe("kindOf", () => {
  it("finds a kind whatever its case", () => {
    expect(kindOf("Agent")?.value).toBe("agent");
  });

  it("finds nothing for what is not a kind", () => {
    expect(kindOf("bot")).toBeUndefined();
  });
});
