#!/usr/bin/env node
/**
 * Publish gate: the defects that only fail at a user's `npm create`.
 *
 *   1. Every `bin` target emitted and starts with a node shebang. Without it,
 *      npm's shim on macOS and Linux hands the file to the shell.
 *   2. Every bare import in `dist/` is a `node:` builtin or a `dependencies`
 *      entry. `npm create` installs no devDependencies, so anything else works
 *      here and throws `ERR_MODULE_NOT_FOUND` there.
 *   3. No specs or source maps reached `dist/`.
 *
 * Whether the packed tarball actually runs is Test's last step, which is the
 * one place that can install it the way `npm create` does.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];
const fail = (msg) => failures.push(msg);

// Either quote: prettier keeps `src/` double-quoted, but nothing holds `dist/`
// to that once a build step other than tsc writes to it.
const importsIn = (source) =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*(["'])([^"']+)\1/g)].map(
    (m) => m[2]
  );

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// --- 1. every bin emitted, with a shebang -----------------------------------

const bins =
  typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : (pkg.bin ?? {});
if (Object.keys(bins).length === 0) fail("package.json declares no bin");
for (const [name, target] of Object.entries(bins)) {
  const file = path.join(root, target);
  if (!existsSync(file)) {
    fail(`bin "${name}" points at ${target}, which does not exist`);
  } else if (!readFileSync(file, "utf8").startsWith("#!/usr/bin/env node\n")) {
    fail(`bin "${name}" (${target}) does not start with #!/usr/bin/env node`);
  }
}

// --- 2 & 3. what reached dist/ ----------------------------------------------

const installed = new Set(Object.keys(pkg.dependencies ?? {}));
// `@scope/name/sub` → `@scope/name`, `name/sub` → `name`.
const packageOf = (spec) =>
  spec
    .split("/")
    .slice(0, spec.startsWith("@") ? 2 : 1)
    .join("/");

let modules = 0;
for (const file of walk(path.join(root, "dist"))) {
  const rel = path.relative(root, file);
  if (/\.spec\.js$/.test(file)) fail(`spec file shipped to dist: ${rel}`);
  if (file.endsWith(".map")) fail(`source map shipped to dist: ${rel}`);
  if (!file.endsWith(".js")) continue;
  modules += 1;
  for (const spec of importsIn(readFileSync(file, "utf8"))) {
    if (spec.startsWith(".") || spec.startsWith("node:")) continue;
    if (!installed.has(packageOf(spec))) {
      fail(
        `${rel} imports "${spec}", which is not in dependencies — ` +
          `\`npm create\` will not install it`
      );
    }
  }
}

// --- report ------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✗ ${pkg.name} is not safe to publish:\n`);
  for (const f of failures) console.error(`  • ${f}`);
  console.error("");
  process.exit(1);
}

// stderr, not stdout: this runs from `prepack`, and `npm pack` prints the
// tarball's name on stdout for the step that runs it.
console.error(
  `✓ ${pkg.name}: bin resolves, ${modules} modules emitted, every import installed`
);
