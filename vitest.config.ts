import { defineConfig, type Plugin } from "vitest/config";

/**
 * The specs' half of the `.tpl` mechanism.
 *
 * `src/agent/templates/` carries every generated file as a real `.tpl` file,
 * and `scripts/build.mjs` hands esbuild `loader: { ".tpl": "text" }` to compile
 * them into the bundle. A spec goes through vite instead, which has never heard
 * of the extension — so the same rule is stated again here, in the six lines it
 * takes. Vite's own `?raw` suffix was the alternative and is not usable: it
 * would put a query string in the import specifier of shipped source, where
 * esbuild and `tsc` would both have to be taught to strip it.
 *
 * `enforce: "pre"` so this runs before vite tries to parse a `.tpl` as
 * JavaScript, and `transform` rather than `load` so the file still goes through
 * vite's resolver and watcher the way an imported module does.
 */
const templatesAsText = (): Plugin => ({
  name: "templates-as-text",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith(".tpl")) return undefined;
    return { code: `export default ${JSON.stringify(code)};`, map: null };
  }
});

export default defineConfig({
  plugins: [templatesAsText()],
  test: {
    /**
     * The specs of this package are `src/**\/*.spec.ts` and nothing else,
     * stated rather than inferred.
     *
     * **What keeps a generated project's spec out is the extension, not this
     * line.** `templates/test/soul.spec.ts.tpl` is a spec of the project this
     * CLI writes — it imports `@dynamicagents/core` and would fail here — and
     * measured, vitest's default glob never matches it: the glob wants a name
     * *ending* in `.spec.ts`, and that one ends in `.tpl`. Collection is the
     * same 18 files with this line and without it.
     *
     * It stays because the set is worth pinning: a `.tpl` dropped from a
     * template's name, or a default that widens, becomes a failure in a file
     * nobody here wrote. One line is cheaper than finding that out.
     */
    include: ["src/**/*.spec.ts"]
  }
});
