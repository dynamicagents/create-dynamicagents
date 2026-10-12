import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMPATIBILITY_DATE,
  DEFAULT_MODEL_ID,
  NODE_ENGINE,
  NODE_VERSION,
  TOOLCHAIN
} from "./train";

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

describe("the compatibility date", () => {
  /**
   * Adopted from create-cloudflare's `compatibility-date.test.ts`. The date is
   * honoured by workerd, whose version is the date — and workerd is installed
   * nowhere a spec here can read it: not a dependency of this package, and only
   * a transitive of the `wrangler` a generated project pins. So what is checked
   * here is the half that needs no runtime, and `.github/workflows/scaffold.yml`
   * is where the real pairing is proven: it installs a generated project and
   * runs its suite, which boots real workerd on this very date.
   */
  it("is a date wrangler can read", () => {
    // `2026-7-6` is refused by wrangler, and `2026-02-30` is not a day.
    expect(COMPATIBILITY_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      new Date(`${COMPATIBILITY_DATE}T00:00:00Z`).toISOString().slice(0, 10)
    ).toBe(COMPATIBILITY_DATE);
  });

  it("is not in the future", () => {
    // A date newer than the installed runtime knows about is a hard error, not
    // a warning — so the one thing a clock can tell us is worth asserting. ISO
    // dates compare lexicographically, and a date in the past stays in the
    // past: this fails only when somebody writes a future one.
    expect(COMPATIBILITY_DATE <= new Date().toISOString().slice(0, 10)).toBe(
      true
    );
  });
});

describe("the fixtures the specs generate from", () => {
  it("name the pins rather than copying them", () => {
    // The guard on the defect this file's constants exist to prevent: a fixture
    // carrying its own copy of a pin makes every assertion against it a
    // comparison of that copy with itself, which is what `wrangler.spec.ts`
    // used to do with the compatibility date. The assertions in
    // `agent/wrangler.spec.ts` and `agent/files.spec.ts` only notice that once
    // a pin moves; this notices the moment a literal is retyped.
    const source = readFileSync(
      new URL("./agent/fixtures.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("DEFAULT_MODEL_ID");
    expect(source).not.toMatch(/"@cf\//);
    expect(DEFAULT_MODEL_ID).toMatch(/^@cf\//);
  });
});
