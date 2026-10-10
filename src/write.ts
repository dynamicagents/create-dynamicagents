/**
 * Putting a plan on disk, and the one guarantee worth having while doing it:
 * either the project is there complete, or nothing is.
 *
 * Every file is written into a temporary directory beside the target, and the
 * directory is then renamed into place — so a failure halfway through leaves no
 * half-written project for somebody to debug, and the rename is atomic within
 * one filesystem, which a sibling directory always is.
 */
import { mkdir, mkdtemp, rename, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedFile } from "./agent/files.js";

/** Write `files` so that `target` either ends up complete or is never created. */
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
    // An empty target directory is allowed — somebody made it before running
    // this — and it has to go before the rename: renaming onto an existing
    // directory is only portable when there is nothing there. Anything with a
    // file in it was refused before this ran, so a failure here is a race, and
    // the rename below reports it.
    await rmdir(target).catch(() => undefined);
    await rename(staging, target);
  } catch (err) {
    await rm(staging, { recursive: true, force: true });
    throw err;
  }
}
