/**
 * The build: one bundle, and nothing of anyone else's left to install.
 *
 * `npm create` installs a package without its devDependencies, and this CLI
 * runs before anything of the user's exists — so the honest number of packages
 * to ask a stranger's npm for is zero. esbuild compiles `@clack/prompts` and
 * its transitives into `dist/cli.js`, `package.json` declares no
 * `dependencies` at all, and `scripts/verify-package.mjs` is what holds that
 * true.
 *
 * Deliberately not minified and not mapped. `dist/cli.js` is the only thing a
 * user ever runs, and "what does `npm create dynamicagents` actually do" should
 * be answerable by reading it; a source map would only point at `src/`, which
 * is not published. The hashbang needs no `banner` either — esbuild keeps the
 * entry's own, and a banner would duplicate it.
 *
 * Typechecking is `tsc` (`noEmit`), separately, in `npm run check`. A bundler
 * is not a typechecker and this one is told nothing about types.
 */
import { rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

/**
 * The Node esbuild may compile for, read from `engines` rather than written
 * twice. Nothing is downlevelled for a Node older than the one this package
 * refuses to run on.
 */
const target = `node${pkg.engines.node.replace(/[^\d.]/g, "")}`;

// A stale module from an earlier build must never reach `files`, and `rm` here
// rather than in the npm script is what makes the clean work on Windows too.
await rm(path.join(root, "dist"), { recursive: true, force: true });

const result = await build({
  // Set, so the metafile below names the same paths wherever this is run from.
  absWorkingDir: root,
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target,
  // Literal box-drawing characters and em dashes rather than `\uXXXX`: this
  // file is read by people, and every string in it is either something the CLI
  // says or a line of a project it writes.
  charset: "utf8",
  metafile: true,
  logLevel: "info"
});

// `build` rejects on an error. A warning it only prints — and a warning here is
// something unresolved or ambiguous in what we are about to publish.
if (result.warnings.length > 0) {
  console.error(
    `\n✗ esbuild reported ${result.warnings.length} warning(s); not writing a bundle anyone would publish.\n`
  );
  process.exit(1);
}

// What went into the bundle, for the publish gate to check against the
// lockfile. Not in `dist`, because `files` ships `dist`.
await writeFile(
  path.join(root, "build-meta.json"),
  `${JSON.stringify(result.metafile, null, 2)}\n`
);
