/**
 * Putting a plan on disk, and the one guarantee worth having while doing it:
 * either the project is there complete, or the directory is as it was.
 *
 * Every file is written into a temporary directory beside the target, and the
 * directory is then renamed into place — so a failure halfway through leaves no
 * half-written project for somebody to debug, and the rename is atomic within
 * one filesystem, which a sibling directory always is.
 *
 * A target that already exists and holds nothing but entries a write leaves
 * alone — a `.git`, a `.DS_Store`; `./existing.ts` has the list — cannot be
 * renamed onto, because renaming onto a directory is only portable when there
 * is nothing in it. So the commit in that one case is a rename **per staged
 * entry** rather than one for the whole directory. Everything the user had
 * stays exactly where it was: nothing is moved aside, nothing is deleted, and
 * the project is written around it. What is given up is a single-syscall
 * commit; what is kept is that the writing — the half that actually fails —
 * still happens in the staging directory, and that a commit failing partway
 * moves our own entries back out of the user's directory.
 */
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import type { GeneratedFile } from "../agent/files";
import { blocking } from "./existing";

/**
 * The target stopped being empty between the judgement and the write.
 *
 * Data rather than prose, the way `./args.ts` answers with `Trouble` and lets
 * `./messages.ts` have the words: `src/cli.ts` turns this into the refusal the
 * run would have printed before the questions, because it is that same
 * refusal — the directory is not empty. The message carries what was found for
 * a log, and nobody reads it in a terminal.
 */
export class TargetChanged extends Error {
  constructor(
    readonly target: string,
    readonly found: readonly string[]
  ) {
    super(`${target} is no longer empty: ${found.join(", ")}`);
    this.name = "TargetChanged";
  }
}

/** What is at `dir`, or nothing where there is no `dir` to read. */
async function entriesAt(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (err) {
    const { code } = err as NodeJS.ErrnoException;
    if (code === "ENOENT") return [];
    // A file where a directory was judged to be is the same race as a file that
    // appeared inside one, and deserves the same answer rather than a raw
    // `ENOTDIR` from whichever call reached it first.
    if (code === "ENOTDIR") throw new TargetChanged(dir, [path.basename(dir)]);
    throw err;
  }
}

/** Whether anything is at `at` already — a dangling symlink included. */
const taken = (at: string): Promise<boolean> =>
  lstat(at).then(
    () => true,
    () => false
  );

/**
 * Move the staged project into a directory that already exists, one top-level
 * entry at a time, and move our own entries back out again if one fails.
 *
 * Only entries this run staged are ever moved, in either direction — which is
 * what makes attempting the roll-back safe at all. One that cannot be moved
 * back stays where it landed and the error is reported: that is the single case
 * that leaves a partial project, and even then nothing of the user's was
 * touched.
 *
 * **A destination is checked before it is written to.** `rename` replaces an
 * existing file without a word, so a name that is taken is refused here rather
 * than written over — which it can only be through a race, since every path
 * this writes is one `./existing.ts` refuses to tolerate. What is left is the
 * window between the check and the rename, and nothing in `node:fs` closes
 * that one: there is no no-clobber rename, and `link` — which would fail on a
 * destination that exists — cannot take a directory, and two of these entries
 * are directories.
 *
 * Sorted, so the order entries land in is the same on every filesystem: a
 * roll-back is easier to reason about, and a spec can rely on which entry
 * fails.
 */
async function commitEntries(staging: string, target: string): Promise<void> {
  const landed: string[] = [];
  try {
    for (const entry of (await readdir(staging)).sort()) {
      const to = path.join(target, entry);
      if (await taken(to)) throw new TargetChanged(target, [entry]);
      await rename(path.join(staging, entry), to);
      landed.push(entry);
    }
  } catch (err) {
    for (const entry of landed.reverse()) {
      await rename(path.join(target, entry), path.join(staging, entry)).catch(
        () => undefined
      );
    }
    throw err;
  }
  // Empty by now, and a temporary directory left behind is not worth failing a
  // project that is complete.
  await rmdir(staging).catch(() => undefined);
}

/** Put the staged project at `target`, however `target` has to be reached. */
async function commit(staging: string, target: string): Promise<void> {
  const existing = await entriesAt(target);
  if (existing.length === 0) {
    // An empty target directory is allowed — somebody made it before running
    // this — and it has to go before the rename: renaming onto an existing
    // directory is only portable when there is nothing there.
    await rmdir(target).catch(() => undefined);
    await rename(staging, target);
    return;
  }
  // The directory was judged before the questions were asked and is read again
  // here: a file that arrived in between is a race, and this is the last place
  // that can still refuse it. Anything a write leaves alone is not one.
  const blocked = blocking(existing);
  if (blocked.length > 0) throw new TargetChanged(target, blocked);
  await commitEntries(staging, target);
}

/** Write `files` so that `target` ends up complete, or as it was before. */
export async function writeProject(
  target: string,
  files: readonly GeneratedFile[]
): Promise<void> {
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".dynamicagents-"));
  try {
    for (const file of files) {
      const full = path.join(staging, file.path);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, file.contents, "utf8");
    }
    await commit(staging, target);
  } catch (err) {
    await rm(staging, { recursive: true, force: true });
    throw err;
  }
}
