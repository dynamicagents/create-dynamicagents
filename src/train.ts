/**
 * The versions a generated project starts on. Pure data, so a spec reads it
 * without a process.
 *
 * At the root beside `cli.ts` rather than inside either half, because both read
 * it: `./cli/` to answer a question and to install, `./agent/templates/` to
 * write the ranges into a project. It belongs to neither.
 *
 * **Everything a generated project runs on is pinned here**, and the reason is
 * not caution. The code this CLI writes *uses* core's classes — `StepAgent`,
 * `TaskHost`, `TaskWorkflow`, `SubAgent`, `defineAgent` — and the config files
 * it writes are read by wrangler, eslint, tsc and vitest, so neither set can
 * honestly ask for "latest": a minor of either moves what the templates were
 * written against. When the train moves, this file moves, and this package
 * follows with a release of its own.
 *
 * Nothing here is validated by this CLI. `npm install` in the generated project
 * is the check — it owns semver, and a conflict between these pins and the
 * train's own declarations is an `ERESOLVE` before any code runs, which
 * `.github/workflows/scaffold.yml` sees on every pull request.
 *
 * `COMPATIBILITY_DATE` is part of the same set, paired with `wrangler`: a date
 * newer than the installed wrangler knows about is a hard error, not a warning.
 */

/** The train itself: what the generated code is written against. */
export const TRAIN = {
  core: ">=0.14.0 <0.15.0",
  plugins: ">=0.14.0 <0.15.0"
} as const;

/**
 * What core needs beside it, and the protocol packages the generated code
 * imports directly. **Never bundled**: two copies of `agents` in one Worker
 * break the `Session` / `SessionMessage` types and every `instanceof`.
 *
 * Each peer range is core's own declaration for that package, copied: a range
 * of our own that core does not allow is an `ERESOLVE` in the generated
 * project, and one narrower than core's denies a user a version that works.
 */
export const RUNTIME = {
  "@cloudflare/think": ">=0.20.2 <0.21.0",
  agents: ">=0.28.0 <0.29.0",
  ai: "^7.0.88",
  "workers-ai-provider": "^4.0.0",
  /** The A2A protocol's own package: its constants and types. */
  "@a2a-js/sdk": "^1.2.0",
  /** A sub-agent's spec declares its input schema in zod. */
  zod: "^4.6.5"
} as const;

/**
 * What a generated project builds, lints, formats and tests with.
 *
 * `@types/node` is the major {@link NODE_ENGINE} names, never a newer one: the
 * declarations are what tells a dev that an API exists, so types ahead of the
 * runtime are a `tsc` that passes and a Worker that throws at the first call.
 * The two move together, in one commit, or neither moves.
 */
export const TOOLCHAIN = {
  /**
   * Paired with {@link WORKERD} as much as `wrangler` is: this pins the
   * miniflare a generated project's tests boot, and that runtime reads the
   * compatibility date too.
   */
  "@cloudflare/vitest-plugin": "^1.4.0",
  "@types/node": "^24.19.2",
  eslint: "^10.10.0",
  prettier: "^3.9.6",
  typescript: "^6.0.3",
  "typescript-eslint": "^8.70.0",
  vitest: "^4.1.11",
  wrangler: "^4.149.0"
} as const;

/**
 * The workerd that {@link TOOLCHAIN}'s `wrangler` floor depends on, exactly as
 * npm resolves it: `npm view wrangler@4.149.0 dependencies.workerd`.
 *
 * Here instead of the compatibility date, because **the date is this version**.
 * A workerd version *is* a release date, and a compatibility date is only ever
 * honoured by the workerd that reads it — so the runtime is the fact and the
 * date is derived from it, which makes the pairing mechanical rather than a
 * thing to remember. Moving `wrangler` above means moving this line, and the
 * date follows on its own.
 *
 * **`@cloudflare/vitest-plugin`'s floor moves with it**, because that plugin
 * pins miniflare exactly and miniflare carries a workerd of its own — the one
 * a generated project's `npm test` boots, reading this same date. A plugin
 * floor older than this version is a project whose tests refuse a date its
 * deploy accepts, so both floors name one runtime: `^1.4.0` pins wrangler
 * 4.149.0 and miniflare 5.20261006.1-alpha, and both are on this workerd.
 *
 * **Pinned, deliberately not derived at run time.** create-cloudflare does the
 * same and for a reason worth copying: workerd refuses a compatibility date
 * more than a few days past the runtime it is running on, so a date that
 * chased the newest release would break every project installed against an
 * older wrangler. What C3 pairs that pin with is a staleness check, which is
 * the half this repository was missing — `.github/workflows/scaffold.yml` now
 * reads the workerd a real install produced and fails when this has fallen too
 * far behind it.
 */
export const WORKERD = "1.20261006.1";

/**
 * The release date inside a workerd version: `1.20260911.1` → `2026-09-11`.
 *
 * Exported for the spec, which is the only thing that calls it with anything
 * but {@link WORKERD}. Throws rather than returning a wrong date, because a
 * silently malformed compatibility date is a generated project that does not
 * start.
 */
export function compatibilityDateOf(workerd: string): string {
  const stamp = /^\d+\.(\d{4})(\d{2})(\d{2})\.\d+$/.exec(workerd);
  if (stamp === null) {
    throw new Error(
      `train: "${workerd}" is not a workerd version (1.YYYYMMDD.N)`
    );
  }
  const [, year, month, day] = stamp;
  return `${year}-${month}-${day}`;
}

/**
 * The Workers compatibility date a generated project declares, which is
 * {@link WORKERD}'s release date and nothing else.
 */
export const COMPATIBILITY_DATE = compatibilityDateOf(WORKERD);

/** The Node a generated project requires, as `engines` spells it. */
export const NODE_ENGINE = ">=24";

/** The `.nvmrc` a generated project ships, matching {@link NODE_ENGINE}. */
export const NODE_VERSION = "24";

/**
 * The model a generated agent runs unless one is named.
 *
 * It must call tools reliably over a long context, because a turn ends when the
 * model stops calling them. Choosing another is one question in the CLI; the
 * catalogue is at {@link MODELS_URL}.
 */
export const DEFAULT_MODEL_ID = "@cf/zai-org/glm-5.3-flash";

/** Where every Workers AI model id comes from. */
export const MODELS_URL = "https://developers.cloudflare.com/ai/models/";
