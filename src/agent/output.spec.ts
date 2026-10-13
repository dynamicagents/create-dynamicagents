import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { projectFiles } from "./files";
import { variants } from "./fixtures";

/**
 * What a generated project weighs, to the byte.
 *
 * Recorded once, from the output of the day `src/agent/templates/` still held
 * every file as a TypeScript template literal, and **not updated** when the
 * templates became real `.tpl` files beside their modules: the whole claim of
 * that conversion is that nothing a user receives changes, and a diff here is
 * the only thing that could tell us otherwise cheaply. So treat a failure as
 * the finding it is — a template whose text moved — and change the snapshot
 * only when the change to what this CLI writes is the point of the commit.
 *
 * A digest per path rather than the contents: the three fixtures together are
 * 75 kB of text that `files.spec.ts`, `wrangler.spec.ts`, `names.spec.ts` and
 * `merge-notes.spec.ts` already read for what it *says*. What is missing from
 * all of them is a single artifact that pins every byte of every file at once,
 * and a hash is that in a hundred lines instead of two thousand. The path list
 * is in it too, so a file that stops being written fails here as loudly as one
 * whose text changed.
 *
 * It is a net under a refactor, not a substitute for the sweeps: layout that
 * depends on the print width is `formatting.spec.ts`'s, which runs the real
 * prettier over tenant ids and descriptions a fixture never has.
 */

/** `path  sha256`, one per line, in the order `projectFiles` returns them. */
const digests = (files: { path: string; contents: string }[]): string =>
  files
    .map(
      (file) =>
        `${file.path}  ${createHash("sha256").update(file.contents).digest("hex")}`
    )
    .join("\n");

describe.each(variants())("$label", ({ spec }) => {
  it("writes the same bytes to the same paths", () => {
    expect(digests(projectFiles(spec))).toMatchSnapshot();
  });
});
