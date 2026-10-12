/**
 * What may already be at the target, and what makes it not empty. Pure, so the
 * spec needs no process.
 *
 * Its own module rather than a block in `./plan.ts`, because both halves of the
 * write read it and neither should have to reach through the other: `./plan.ts`
 * judges a directory before the questions, `./write.ts` reads the same list
 * again at the moment it commits, and nothing about a name belongs in the bin.
 *
 * **There are two concepts here, empty and not empty.** A directory holding
 * nothing but these entries *is* empty as far as this CLI is concerned: the run
 * goes ahead in silence, exactly as it does into one with nothing in it, and
 * none of them is moved, written over or deleted — `./write.ts` writes the
 * project around them. A directory holding anything else is not empty and is
 * refused in `./messages.ts`'s own words. There is no third state to explain to
 * anybody, which is why nothing this CLI prints mentions this list.
 */

/**
 * Every entry a directory may hold and still count as empty, by exact name.
 *
 * The first one is the case that matters: `mkdir my-agent && cd my-agent && git
 * init` before running this is how plenty of people start, and `.DS_Store`
 * arrives on macOS from opening the folder. Everything here is either somebody
 * else's state, which this must never touch, or a file the OS wrote on its own.
 *
 * What is deliberately **not** here: `.gitignore`, `README.md`, `LICENSE`,
 * `package.json`, `docs/`. create-cloudflare and create-react-app tolerate
 * several of those and this cannot — the generator writes `.gitignore` and
 * `README.md` itself, so tolerating one would mean silently keeping a user's
 * file in a project that expects ours, and the rest mean the directory is
 * already somebody's project. Those are refused, and that is the honest answer.
 */
export const IGNORABLE = [
  // A repository made before the tool ran.
  ".git",
  ".hg",
  ".svn",
  // The placeholder that made the empty directory in the first place.
  ".gitkeep",
  ".keep",
  // An editor was opened on it.
  ".idea",
  ".vscode",
  // Finder and Explorer, writing without being asked.
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini"
] as const;

/**
 * Compared lowercased, because `Desktop.ini` and `desktop.ini` are one file on
 * the platform that writes it — as are `.DS_Store` and `.ds_store` on a Mac's
 * default volume. The consequence is that a file somebody deliberately named
 * `.ds_store` is tolerated too, which costs nothing: it is left alone either
 * way.
 */
const names = new Set<string>(IGNORABLE.map((entry) => entry.toLowerCase()));

/** Whether this entry is one a write leaves where it is. */
export const ignorable = (entry: string): boolean =>
  names.has(entry.toLowerCase());

/**
 * The entries that make a directory not empty — empty itself when none do.
 *
 * The list rather than a boolean, so `./write.ts` can say what it found when a
 * file arrives between the judgement and the commit.
 */
export const blocking = (entries: readonly string[]): string[] =>
  entries.filter((entry) => !ignorable(entry));
