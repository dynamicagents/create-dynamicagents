import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import { projectFiles } from "./files.js";
import { specs, variants } from "./fixtures.js";

/**
 * Everything this CLI writes is already formatted.
 *
 * It has to be: a generated project runs `prettier --check .` as the first half
 * of its own `npm run check`, so output that merely parses would hand every new
 * project a failing check on its first run. Prettier is a devDependency and
 * cannot be imported at runtime — nothing a user installs would have it — so
 * the layout rules the templates follow are implemented in
 * `./templates/text.ts` and held to the real prettier here.
 *
 * The sweeps matter as much as the cases: the rules are about **width**, and a
 * tenant id or a description one character either side of the print width is
 * where a hand-rolled layout goes wrong. A fixture set alone would only prove
 * the lengths somebody happened to pick.
 */

const options = { trailingComma: "none" } as const;

/** What prettier itself would do to this path, or `undefined` if it ignores it. */
async function formatted(
  path: string,
  contents: string
): Promise<string | undefined> {
  const { inferredParser } = await prettier.getFileInfo(path);
  if (inferredParser === null) return undefined;
  return prettier.format(contents, { ...options, filepath: path });
}

describe.each(variants())("$label", ({ spec }) => {
  it("writes every file already formatted", async () => {
    const offenders: string[] = [];
    for (const file of projectFiles(spec)) {
      const output = await formatted(file.path, file.contents);
      if (output !== undefined && output !== file.contents) {
        offenders.push(file.path);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("across the print width", () => {
  /**
   * A description that crosses 80 columns in the card, the stub card and the
   * manifest's skills, one character at a time.
   */
  it.each([60, 70, 72, 74, 76, 78, 80, 82, 90, 120, 180])(
    "stays formatted with a %i-character description",
    async (length) => {
      const spec = { ...specs.full, description: `${"a".repeat(length - 1)}.` };
      for (const file of projectFiles(spec)) {
        const output = await formatted(file.path, file.contents);
        if (output !== undefined) {
          expect(output, `${file.path} (description ${length})`).toBe(
            file.contents
          );
        }
      }
    }
  );

  /** A tenant id long enough to push class names and tables past the width. */
  it.each([2, 8, 16, 24, 32])(
    "stays formatted with a %i-character tenant id",
    async (length) => {
      const tenant = `a${"b".repeat(length - 1)}`;
      const spec = { ...specs.full, tenant, name: tenant };
      for (const file of projectFiles(spec)) {
        const output = await formatted(file.path, file.contents);
        if (output !== undefined) {
          expect(output, `${file.path} (tenant ${length})`).toBe(file.contents);
        }
      }
    }
  );
});
