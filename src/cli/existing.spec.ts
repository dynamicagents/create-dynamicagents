import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectFiles } from "../agent/files";
import { specs } from "../agent/fixtures";
import { IGNORABLE, blocking, ignorable } from "./existing";
import { stateOf } from "./plan";

/**
 * What a directory's entries make of it.
 *
 * The whole of this is one distinction — empty or not empty — and the cases
 * here are the ones a user actually arrives with: a directory they made and ran
 * `git init` in, one Finder has touched, one that is already somebody's project.
 */

describe("stateOf", () => {
  it("calls a directory with nothing in it empty", () => {
    expect(stateOf([])).toBe("empty");
  });

  it("calls one holding nothing but tolerated entries empty too", () => {
    // `mkdir my-agent && cd my-agent && git init` is how plenty of people
    // start, and this is the case the whole change is for.
    for (const entries of [
      [".git"],
      [".DS_Store"],
      [".git", ".DS_Store"],
      [".vscode", ".keep"],
      [...IGNORABLE]
    ]) {
      expect(stateOf(entries), entries.join(" ")).toBe("ignorable");
    }
  });

  it("calls one holding anything else occupied, junk or no junk", () => {
    expect(stateOf(["notes.md"])).toBe("occupied");
    expect(stateOf([".git", "notes.md", ".DS_Store"])).toBe("occupied");
    // A file this generator writes is content, however it got there: keeping
    // somebody's `.gitignore` in a project that expects ours would be worse
    // than refusing.
    expect(stateOf([".gitignore"])).toBe("occupied");
    expect(stateOf(["src"])).toBe("occupied");
  });
});

describe("blocking", () => {
  it("names what makes the directory not empty, and nothing else", () => {
    expect(blocking([".git", "notes.md", ".DS_Store", "src"])).toEqual([
      "notes.md",
      "src"
    ]);
    expect(blocking([".git", ".idea"])).toEqual([]);
  });
});

describe("ignorable", () => {
  it("matches whatever the case the platform wrote", () => {
    // Windows writes `Thumbs.db` and `desktop.ini`; a Mac's default volume
    // cannot tell `.DS_Store` from `.ds_store` in the first place.
    for (const entry of [
      "Thumbs.db",
      "thumbs.db",
      "Desktop.ini",
      "desktop.ini",
      ".DS_Store",
      ".ds_store",
      ".GIT"
    ]) {
      expect(ignorable(entry), entry).toBe(true);
    }
    expect(ignorable("notes.md")).toBe(false);
  });
});

describe("IGNORABLE", () => {
  it("names nothing this generator writes", () => {
    // The rule that keeps "tolerated" from ever meaning "we kept your version
    // of a file the project needs ours for": a name on both lists would be a
    // file left in place and a generated file silently missing.
    //
    // Asked of `ignorable` itself rather than of the list, and in this
    // direction: the write tolerates a name case-insensitively, so comparing
    // spellings would stay green on a generated `.Git` that `ignorable` would
    // have left in place.
    const written = new Set(
      Object.values(specs).flatMap((spec) =>
        projectFiles(spec).map((file) => file.path.split("/")[0]!)
      )
    );
    for (const entry of written) {
      expect(ignorable(entry), entry).toBe(false);
    }
    // Both lists are non-empty, so the loop above is a claim and not a
    // vacuous pass.
    expect(written.size).toBeGreaterThan(10);
    expect(IGNORABLE.length).toBeGreaterThan(0);
  });

  it("is the list README documents", () => {
    // The rule the flags already follow, for the same reason: a name the write
    // tolerates and nothing documents is behaviour nobody outside this
    // repository can predict — somebody reading the README on npm cannot read
    // `./existing.ts`. So the list arrives whole, here and there.
    const readme = readFileSync(
      new URL("../../README.md", import.meta.url),
      "utf8"
    );
    for (const entry of IGNORABLE) {
      expect(readme, entry).toContain(`\`${entry}\``);
    }
  });
});
