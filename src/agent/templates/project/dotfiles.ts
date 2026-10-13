/**
 * The files a generated project needs that say nothing about the agent: how it
 * builds, lints, formats and typechecks, and what git ignores.
 *
 * Constants, like `./shared.ts` and for the same reason — identical in every
 * generated project, so a later merge has nothing to reconcile. Five of them
 * are `.tpl` files with no bindings; the two that are not are the two with
 * nothing to hold in a file.
 *
 * `tsconfig.json` carries no comments on purpose: prettier's own parser for it
 * is the JSON one, and the explanations that would go in it are in the
 * generated AGENTS.md instead. The toolchain these are written against is
 * pinned in `src/train.ts`.
 */
import { NODE_VERSION } from "../../../train";
import { jsonFile } from "../text";
import eslintConfigJsSource from "./eslint.config.js.tpl";
import gitignoreSource from "./gitignore.tpl";
import prettierignoreSource from "./prettierignore.tpl";
import testTsconfigJsonSource from "./test-tsconfig.json.tpl";
import tsconfigJsonSource from "./tsconfig.json.tpl";

/**
 * `tsconfig.json` — the Worker's own sources.
 *
 * A file rather than `jsonFile`, because it has arrays in it: prettier puts a
 * short array on one line and `JSON.stringify` never does.
 */
export const tsconfigJson = tsconfigJsonSource;

/**
 * `test/tsconfig.json` — the suite, which additionally sees `cloudflare:test`.
 * A separate project because those types have no business in the Worker's.
 */
export const testTsconfigJson = testTsconfigJsonSource;

/**
 * `.prettierrc` — the one dotfile still built rather than held, because
 * prettier's parser for an extensionless `.prettierrc` is the **yaml** one. A
 * `.tpl` of it would be checked as yaml here and written as json there, which
 * is two formatters over one file; `jsonFile` is shorter than that argument.
 */
export const prettierrc = jsonFile({ trailingComma: "none" });

/** `.nvmrc` — the pin itself, and nothing else to hold in a file. */
export const nvmrc = `${NODE_VERSION}\n`;

/** `.prettierignore` */
export const prettierignore = prettierignoreSource;

/** `.gitignore` */
export const gitignore = gitignoreSource;

/** `eslint.config.js` */
export const eslintConfigJs = eslintConfigJsSource;
