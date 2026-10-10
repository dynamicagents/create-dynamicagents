/**
 * The versions a generated project starts on. Pure data, so a spec reads it
 * without a process.
 *
 * **Everything a generated project runs on is pinned here**, and the reason is
 * not caution. The code this CLI writes *uses* core's classes — `StepAgent`,
 * `TaskHost`, `TaskWorkflow`, `SubAgent`, `defineAgent` — and the config files
 * it writes are read by wrangler, eslint, tsc and vitest, so neither set can
 * honestly ask for "latest": a minor of either moves what the templates were
 * written against. When the train moves, this file moves, and this package
 * follows with a release of its own.
 *
 * It is also not enough to copy what core *allows*, which was the obvious
 * design and does not work: see {@link RUNTIME}'s note on `@cloudflare/think`.
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
  core: ">=0.13.1 <0.14.0",
  plugins: ">=0.13.0 <0.14.0"
} as const;

/**
 * What core needs beside it, and the protocol packages the generated code
 * imports directly. **Never bundled**: two copies of `agents` in one Worker
 * break the `Session` / `SessionMessage` types and every `instanceof`.
 *
 * Each range is core's own declaration for that package, with one exception
 * that is measured rather than chosen:
 *
 * **`@cloudflare/think` stops below 0.20.2.** Core asks for `>=0.20.0 <0.21.0`
 * and for `agents >=0.26.0 <0.27.0`, and those two are not jointly satisfiable
 * at their newest points: think 0.20.2 raised its own `agents` peer to
 * `>=0.28.0`, so installing the newest think core allows produces an
 * `ERESOLVE` against the `agents` core allows. The upper bound here is the
 * version where that happened, and it moves when core's `agents` range does.
 */
export const RUNTIME = {
  "@cloudflare/think": ">=0.20.0 <0.20.2",
  agents: ">=0.26.0 <0.27.0",
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
  "@cloudflare/vitest-plugin": "^1.2.0",
  "@types/node": "^24.19.2",
  eslint: "^10.10.0",
  prettier: "^3.9.6",
  typescript: "^6.0.3",
  "typescript-eslint": "^8.70.0",
  vitest: "^4.1.11",
  wrangler: "^4.131.2"
} as const;

/**
 * The Workers compatibility date, paired with {@link TOOLCHAIN}'s `wrangler`.
 * Moved with it, never ahead of it.
 */
export const COMPATIBILITY_DATE = "2026-07-06";

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
