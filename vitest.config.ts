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
     * Stated rather than left to the default, which is a glob wide enough to
     * collect `soul.spec.ts.tpl` — a *generated* project's spec, which imports
     * `@dynamicagents/core` and is not meant to run here — as a suite of this
     * one. The specs of this package are `src/**\/*.spec.ts` and nothing else.
     */
    include: ["src/**/*.spec.ts"]
  }
});
