#!/usr/bin/env node
/**
 * Staleness gate: the compatibility date a user receives, against the workerd a
 * user's install actually produces.
 *
 * `src/train.ts` derives `COMPATIBILITY_DATE` from `WORKERD` — the workerd it
 * declares the pinned wrangler installs — and that pin is deliberate rather
 * than timid. A date chased to the newest release would break every project
 * installed against an older wrangler, because workerd refuses a compatibility
 * date newer than the runtime reading it. create-cloudflare pins for the same
 * reason.
 *
 * The risk a pin carries is the opposite one, and it is quiet: it goes stale,
 * until a new project starts on a runtime a year behind and nobody noticed
 * because nothing was ever wrong. C3 pairs its pin with a check for exactly
 * that, and this is ours.
 *
 * **It can only run where an install exists.** workerd is not a dependency of
 * this package and never will be — it arrives as a transitive of the `wrangler`
 * a *generated* project pins, so there is no local `npm test` that could read
 * it. `.github/workflows/scaffold.yml` scaffolds a project and installs it on
 * every pull request, which is the one place both halves of the pair are on
 * disk at once. By hand, against such a project:
 *
 *     node scripts/check-compat-date.mjs /path/to/generated-project
 *
 * Not published — `files` ships `dist` — so this may use anything, though it
 * happens to need nothing.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * How far behind the installed runtime the pin may fall before this fails.
 *
 * Thirty days is about one wrangler minor: long enough that an ordinary
 * dependency bump in the train does not trip it, short enough that a pin
 * nobody is maintaining fails within a release or two of going stale.
 */
const MAX_DAYS_BEHIND = 30;

/** `1.20260911.1` → `2026-09-11`. The same reading as `src/train.ts`'s. */
function releaseDate(version) {
  const stamp = /^\d+\.(\d{4})(\d{2})(\d{2})\.\d+$/.exec(version);
  if (stamp === null) {
    throw new Error(`workerd "${version}" is not a version (1.YYYYMMDD.N)`);
  }
  const [, year, month, day] = stamp;
  return `${year}-${month}-${day}`;
}

const project = path.resolve(process.argv[2] ?? ".");

/**
 * The date the user receives, read out of the generated file rather than out of
 * `src/train.ts`: a template that stopped reading the derivation is one of the
 * things worth catching here. It is JSONC, so this is matched rather than
 * parsed — and a miss fails, because a `wrangler.jsonc` with no compatibility
 * date is not something to pass quietly.
 */
const config = readFileSync(path.join(project, "wrangler.jsonc"), "utf8");
const found = /"compatibility_date":\s*"(\d{4}-\d{2}-\d{2})"/.exec(config);
if (found === null) {
  console.error(
    `\n✗ ${project}/wrangler.jsonc declares no compatibility_date\n`
  );
  process.exit(1);
}
const [, date] = found;

// The runtime the install produced, resolved from the project rather than from
// here: this package has no workerd and the project's is the one that matters.
const require = createRequire(path.join(project, "package.json"));
const installed = require("workerd/package.json").version;
const runtime = releaseDate(installed);

const days = Math.round(
  (Date.parse(`${runtime}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
    86_400_000
);
const summary =
  `compatibility_date ${date}, workerd ${installed} (${runtime}), ` +
  `${days} day(s) behind`;

if (days < 0) {
  console.error(
    `\n✗ ${summary} — the date is *ahead* of the runtime, which workerd ` +
      `rejects outright rather than warning about. Lower WORKERD in ` +
      `src/train.ts to the workerd the pinned wrangler installs.\n`
  );
  process.exit(1);
}

if (days > MAX_DAYS_BEHIND) {
  console.error(
    `\n✗ ${summary}, past the ${MAX_DAYS_BEHIND}-day limit.\n\n` +
      `  Bump wrangler and WORKERD together in src/train.ts — they are one\n` +
      `  decision. WORKERD is what npm resolves for the new floor:\n\n` +
      `      npm view wrangler@<floor> dependencies.workerd\n\n` +
      `  COMPATIBILITY_DATE follows from it, and one more floor moves with\n` +
      `  it: @cloudflare/vitest-plugin pins the miniflare a generated\n` +
      `  project's tests boot, and that workerd reads this date too — move\n` +
      `  it to a version whose miniflare carries the new WORKERD.\n`
  );
  process.exit(1);
}

console.log(`✓ ${summary}, within ${MAX_DAYS_BEHIND} days`);
