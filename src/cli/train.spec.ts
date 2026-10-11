import { describe, expect, it } from "vitest";
import { NODE_ENGINE, NODE_VERSION, TOOLCHAIN } from "./train.js";

/**
 * The pins themselves are npm's to judge — `npm install` in a generated project
 * is what proves a range is satisfiable, and CI runs it. What a spec can hold is
 * the one place this file says the same thing three times.
 */

const major = (range: string): string =>
  range.replace(/^[^\d]*/, "").split(".")[0]!;

describe("the Node a generated project asks for", () => {
  it("is typed at the major its engine and its .nvmrc name", () => {
    // Types ahead of the runtime is the failure worth a spec: a Node 26-only
    // API would pass both generated `tsc` projects and then throw on the Node
    // the project requires. The three move together or not at all.
    expect(major(NODE_ENGINE)).toBe(NODE_VERSION);
    expect(major(TOOLCHAIN["@types/node"])).toBe(NODE_VERSION);
  });
});
