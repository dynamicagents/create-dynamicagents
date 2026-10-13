/**
 * A `.tpl` file is text, and `tsc` is told so here.
 *
 * `scripts/build.mjs` gives esbuild `loader: { ".tpl": "text" }` and
 * `vitest.config.ts` does the same for the specs; this is the third place that
 * has to agree, because `tsc` resolves `./copy.ts.tpl` as a module otherwise
 * and has no idea what one is. A wildcard rather than a declaration per file:
 * there is one shape, and 30 copies of it would be 30 chances to forget one.
 *
 * Deliberately *not* a module with imports or exports of its own — a global
 * `declare module` is only global in a script, and an `import` at the top of
 * this file would make it a module and the declaration local to it.
 */
declare module "*.tpl" {
  /** The file's bytes, as written. `./render.ts` is what binds its variation. */
  const text: string;
  export default text;
}
