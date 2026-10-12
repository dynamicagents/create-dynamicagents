import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GeneratedFile } from "../agent/files";
import { TargetChanged, writeProject } from "./write";

/**
 * The one guarantee this package makes about the filesystem: a project arrives
 * complete, or the directory is as it was.
 *
 * The one spec here that touches a disk, and it has to: no pure function has a
 * rename in it, and the claim is about what is left behind when one fails. It
 * spawns nothing — the rule in AGENTS.md is about processes, and `src/cli.spec.ts`
 * is still the only spec with one.
 *
 * Every case writes a short file list rather than a real project. What is under
 * test is the commit, and `projectFiles` has specs of its own.
 */

const files: GeneratedFile[] = [
  { path: "package.json", contents: "{}\n" },
  { path: "src/index.ts", contents: "export default {};\n" },
  { path: "test/turn.spec.ts", contents: "// a test\n" }
];

/** A list that cannot be written: `a` is a file, so `a/b` has no directory. */
const impossible: GeneratedFile[] = [
  { path: "a", contents: "a file\n" },
  { path: "a/b", contents: "under a file\n" }
];

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "write-spec-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

/** Everything at `dir`, sorted, so a comparison reads in one line. */
const entries = async (dir: string): Promise<string[]> =>
  (await readdir(dir)).sort();

const wrote = async (dir: string): Promise<void> => {
  expect(await entries(dir)).toContain("package.json");
  expect(await readFile(path.join(dir, "src/index.ts"), "utf8")).toBe(
    "export default {};\n"
  );
};

/** No staging directory may outlive a run, finished or failed. */
const noStagingLeft = async (): Promise<void> => {
  expect(
    (await entries(workspace)).filter((entry) =>
      entry.startsWith(".dynamicagents-")
    )
  ).toEqual([]);
};

describe("writeProject", () => {
  it("writes a project where there was nothing", async () => {
    const target = path.join(workspace, "demo");
    await writeProject(target, files);
    await wrote(target);
    await noStagingLeft();
  });

  it("writes into a directory somebody made first", async () => {
    const target = path.join(workspace, "demo");
    await mkdir(target);
    await writeProject(target, files);
    await wrote(target);
    await noStagingLeft();
  });

  it("writes around a repository, leaving it exactly as it was", async () => {
    // The case the change is for: `mkdir demo && cd demo && git init`. A `.git`
    // is the user's history, so the test is not only that it survives — it is
    // that every byte of it does.
    const target = path.join(workspace, "demo");
    await mkdir(path.join(target, ".git", "refs"), { recursive: true });
    await writeFile(path.join(target, ".git", "HEAD"), "ref: main\n", "utf8");
    await writeProject(target, files);
    await wrote(target);
    expect(await readFile(path.join(target, ".git", "HEAD"), "utf8")).toBe(
      "ref: main\n"
    );
    expect(await entries(path.join(target, ".git"))).toEqual(["HEAD", "refs"]);
    await noStagingLeft();
  });

  it("leaves what the OS left behind where it is", async () => {
    // Tolerated, never deleted: the generated `.gitignore` already ignores
    // this one, so leaving it costs the user nothing at all.
    const target = path.join(workspace, "demo");
    await mkdir(target);
    await writeFile(path.join(target, ".DS_Store"), "junk", "utf8");
    await writeProject(target, files);
    await wrote(target);
    expect(await readFile(path.join(target, ".DS_Store"), "utf8")).toBe("junk");
  });

  it("leaves the directory as it was when the write fails", async () => {
    const target = path.join(workspace, "demo");
    await mkdir(target);
    await writeFile(path.join(target, ".DS_Store"), "junk", "utf8");
    await expect(writeProject(target, impossible)).rejects.toThrow();
    // Not a single file of ours, and everything of theirs.
    expect(await entries(target)).toEqual([".DS_Store"]);
    await noStagingLeft();
  });

  it("refuses a name already taken rather than writing over it", async () => {
    // `rename` replaces a file without a word, so the commit checks each
    // destination first. In a real run only a race can get a file there, since
    // every path this writes is one `./existing.ts` refuses to tolerate — so
    // the collision is staged here deliberately, with a file list naming an
    // entry the target is allowed to hold.
    const target = path.join(workspace, "demo");
    await mkdir(target);
    await writeFile(path.join(target, "desktop.ini"), "theirs\n", "utf8");
    await expect(
      writeProject(target, [{ path: "desktop.ini", contents: "ours\n" }])
    ).rejects.toThrow(TargetChanged);
    expect(await readFile(path.join(target, "desktop.ini"), "utf8")).toBe(
      "theirs\n"
    );
    await noStagingLeft();
  });

  it("moves its own entries back out when the commit fails partway", async () => {
    // The roll-back, driven rather than reasoned about: `AGENTS.md` lands, then
    // `desktop.ini` collides, and what the directory is left holding is what it
    // held before. The commit sorts, so it is always that way round.
    const target = path.join(workspace, "demo");
    await mkdir(target);
    await writeFile(path.join(target, "desktop.ini"), "theirs\n", "utf8");
    await expect(
      writeProject(target, [
        { path: "AGENTS.md", contents: "ours\n" },
        { path: "desktop.ini", contents: "ours\n" }
      ])
    ).rejects.toThrow(TargetChanged);
    expect(await entries(target)).toEqual(["desktop.ini"]);
    expect(await readFile(path.join(target, "desktop.ini"), "utf8")).toBe(
      "theirs\n"
    );
    await noStagingLeft();
  });

  it("refuses a directory that stopped being empty, and writes nothing", async () => {
    // The race: judged before the questions, read again at the commit. Only
    // this side of the write can still catch it.
    const target = path.join(workspace, "demo");
    await mkdir(target);
    await writeFile(path.join(target, "notes.md"), "mine\n", "utf8");
    await expect(writeProject(target, files)).rejects.toThrow(TargetChanged);
    expect(await entries(target)).toEqual(["notes.md"]);
    await noStagingLeft();
  });
});
