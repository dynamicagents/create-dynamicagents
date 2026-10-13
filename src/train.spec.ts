import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMPATIBILITY_DATE,
  DEFAULT_MODEL_ID,
  NODE_ENGINE,
  NODE_VERSION,
  TOOLCHAIN,
  WORKERD,
  compatibilityDateOf
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
   * Adopted from create-cloudflare's `compatibility-date.test.ts`, and now
   * about a derivation rather than a literal: the date is {@link WORKERD}'s
   * release date, because a compatibility date is only honoured by the workerd
   * that reads it.
   *
   * workerd is installed nowhere a spec here can read it — not a dependency of
   * this package, and only a transitive of the `wrangler` a generated project
   * pins — so what is checked here is the half that needs no runtime: that the
   * derivation is right and the pin is sane. The other half, whether this date
   * has fallen behind the workerd a real install produces, is
   * `.github/workflows/scaffold.yml`'s, which can read the installed version.
   */
  it("is the release date inside the pinned workerd", () => {
    expect(compatibilityDateOf("1.20260911.1")).toBe("2026-09-11");
    expect(COMPATIBILITY_DATE).toBe(compatibilityDateOf(WORKERD));
  });

  it("refuses anything that is not a workerd version", () => {
    // A wrong date is a generated project that does not start, so this throws
    // rather than returning something plausible.
    for (const bad of ["1.2026091.1", "2026-09-11", "1.20260911", "", "x"]) {
      expect(() => compatibilityDateOf(bad), bad).toThrow("not a workerd");
    }
  });

  it("is a date wrangler can read", () => {
    // `2026-9-11` is refused by wrangler, and `2026-02-30` is not a day — the
    // second of which the derivation cannot catch, since it only reads digits
    // out of a version string.
    expect(COMPATIBILITY_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      new Date(`${COMPATIBILITY_DATE}T00:00:00Z`).toISOString().slice(0, 10)
    ).toBe(COMPATIBILITY_DATE);
  });

  it("is not in the future", () => {
    // A date newer than the installed runtime knows about is a hard error, not
    // a warning — so the one thing a clock can tell us is worth asserting. ISO
    // dates compare lexicographically, and a date in the past stays in the
    // past: this fails only when somebody pins an unreleased workerd.
    expect(COMPATIBILITY_DATE <= new Date().toISOString().slice(0, 10)).toBe(
      true
    );
  });

  it("is past the date that made nodejs_compat the default", () => {
    // What lets `wrangler.jsonc` carry no `compatibility_flags` at all.
    // workerd's own constant, read out of the wrangler this CLI pins:
    // `NODEJS_COMPAT_DEFAULT_ON_DATE = "2026-08-04"`. A pin older than that
    // would need the flag back, and `agent/wrangler.spec.ts` asserts it is
    // gone — so this is the spec that says why that is safe.
    expect(COMPATIBILITY_DATE >= "2026-08-04").toBe(true);
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
    // Every delimiter a string can open with, not only the one prettier
    // settles on: a copied value in backticks is left exactly as it was typed,
    // so a guard that only knew about `"` would pass on it.
    expect(source).not.toMatch(/["'`]@cf\//);
    expect(DEFAULT_MODEL_ID).toMatch(/^@cf\//);
  });
});
