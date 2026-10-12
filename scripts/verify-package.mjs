#!/usr/bin/env node
/**
 * Publish gate: the defects that only fail at a user's `npm create`.
 *
 *   1. `package.json` asks for no runtime dependencies at all. This is the
 *      whole shape of the package, asserted rather than inferred: with no
 *      `dependencies`, `npm create` downloads this and stops.
 *   2. Nothing that ships imports a package that is not compiled in. Bundling
 *      **inverts** the mistake this file was first written for: an import of a
 *      devDependency used to throw `ERR_MODULE_NOT_FOUND` on the user's
 *      machine, and now esbuild quietly compiles it in instead — so the only
 *      place to catch it is the source, before the bundler forgives it.
 *   3. Every bare import left in `dist/` is a node builtin, because a bundle
 *      that reaches for anything else reaches for something nobody installed.
 *   4. `dist/` is the bin and nothing else: no map, no spec, no module left
 *      over from when this package shipped `tsc` output.
 *   5. What esbuild compiled in is what we meant to compile in — checked
 *      against the lockfile, so a transitive that arrives with a clack patch
 *      is noticed rather than shipped.
 *
 * Whether the packed tarball actually runs is Test's last step, which is the
 * one place that can install it the way `npm create` does.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
// A devDependency, and allowed: this script is never published — `files` ships
// `dist` — so it may use anything the repository builds with.
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];
const fail = (msg) => failures.push(msg);

/**
 * The packages this CLI is allowed to compile into its bundle.
 *
 * Shipped source may import these and node builtins, and nothing else. They
 * stay devDependencies: a user installs the bundle they are already inside, so
 * declaring them as `dependencies` would ask npm to fetch them twice over.
 *
 * Adding a line here is a decision to ship somebody else's code — their
 * licence, their bugs, their patch cadence against our release cadence — so it
 * belongs in a diff rather than in a resolver.
 */
const BUNDLED = ["@clack/prompts"];

/** `@scope/name/sub` → `@scope/name`, `name/sub` → `name`. */
const packageOf = (spec) =>
  spec
    .split("/")
    .slice(0, spec.startsWith("@") ? 2 : 1)
    .join("/");

/**
 * Every module specifier a file actually imports: `import`, `export … from`,
 * and a dynamic `import()`. Each one carries whether its whole declaration is
 * type-only, which `verbatimModuleSyntax` promises is erased before a bundler
 * ever sees it.
 *
 * **Parsed, not matched.** This CLI's own source carries whole generated files
 * as string data — `src/agent/templates/` is nothing but TypeScript inside
 * template literals — so a pattern looking for `from "…"` finds the *generated*
 * project's imports in every one of them, and prose such as "not given" from
 * "given false" besides. Bundling makes that worse rather than better: all of
 * those template literals now sit in the one file checked below, where a regex
 * would read `@dynamicagents/core` as a dependency of this package. A specifier
 * is a syntactic position, and the compiler the repository already builds with
 * is what knows one.
 */
function importsIn(source, file, kind) {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    false,
    kind
  );
  const specifiers = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push({
        text: node.moduleSpecifier.text,
        typeOnly:
          node.isTypeOnly === true || node.importClause?.isTypeOnly === true
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push({ text: node.arguments[0].text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(tree, visit);
  return specifiers;
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// --- 1. nothing for a user's npm to resolve ---------------------------------

const RUNTIME_FIELDS = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies"
];
for (const field of RUNTIME_FIELDS) {
  const declared = Object.keys(pkg[field] ?? {});
  if (declared.length > 0) {
    fail(
      `package.json declares ${field}: ${declared.join(", ")} — this package ` +
        `bundles what it needs, so a user installs it and nothing else. ` +
        `Compile the dependency in (see BUNDLED in this file), or decide ` +
        `deliberately that this package has a runtime dependency and change ` +
        `this check.`
    );
  }
}

const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
for (const name of BUNDLED) {
  if (!devDeps.has(name)) {
    fail(
      `BUNDLED names "${name}", which is not a devDependency — nothing would ` +
        `install it for the build`
    );
  }
}

// --- 2. what the shipped source imports -------------------------------------

/**
 * `*.spec.ts` and the fixtures only a spec reads. Nothing a bundle rooted at
 * the bin can reach, so what they import — vitest, prettier, typescript — is
 * not shipped and not this gate's business.
 */
const notShipped = (rel) =>
  rel.endsWith(".spec.ts") || rel === path.join("src", "agent", "fixtures.ts");

/** A relative specifier naming a file by extension, which this repo does not. */
const CARRIES_EXTENSION = /\.(m|c)?[jt]sx?$/;

const bundled = new Set(BUNDLED);
let shipped = 0;
for (const file of walk(path.join(root, "src"))) {
  const rel = path.relative(root, file);
  if (!file.endsWith(".ts") || notShipped(rel)) continue;
  shipped += 1;
  for (const { text, typeOnly } of importsIn(
    readFileSync(file, "utf8"),
    file,
    ts.ScriptKind.TS
  )) {
    if (text.startsWith(".")) {
      // esbuild resolves both forms, so nothing else would catch the drift:
      // relative imports name a file without its extension, the way the
      // generated projects and the rest of the train are written.
      if (CARRIES_EXTENSION.test(text)) {
        fail(`${rel} imports "${text}" — relative imports carry no extension`);
      }
      continue;
    }
    // Erased before the bundler runs, so it ships nothing either way.
    if (typeOnly) continue;
    const name = packageOf(text);
    if (isBuiltin(text) || bundled.has(name)) continue;
    fail(
      `${rel} imports "${text}", which is neither a node builtin nor one of ` +
        `the packages this CLI bundles — esbuild would compile it into ` +
        `dist/cli.js and ship it to every user. Add it to BUNDLED in this ` +
        `file if that is the intent.`
    );
  }
}

// --- 3 & 4. what reached dist/ ----------------------------------------------

const bins =
  typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : (pkg.bin ?? {});
if (Object.keys(bins).length === 0) fail("package.json declares no bin");

const binTargets = new Set(
  Object.values(bins).map((target) => path.normalize(target))
);
for (const [name, target] of Object.entries(bins)) {
  const file = path.join(root, target);
  if (!existsSync(file)) {
    fail(`bin "${name}" points at ${target}, which does not exist`);
  } else if (!readFileSync(file, "utf8").startsWith("#!/usr/bin/env node\n")) {
    fail(`bin "${name}" (${target}) does not start with #!/usr/bin/env node`);
  }
}

const dist = path.join(root, "dist");
if (!existsSync(dist)) fail("dist/ does not exist — run `npm run build`");

for (const file of walk(dist)) {
  const rel = path.relative(root, file);
  if (/\.spec\.js$/.test(file)) fail(`spec file shipped to dist: ${rel}`);
  else if (file.endsWith(".map")) fail(`source map shipped to dist: ${rel}`);
  else if (!binTargets.has(rel)) {
    fail(
      `dist holds ${rel}, which is not a bin — the build writes one bundle, ` +
        `and \`files\` ships whatever else is lying there`
    );
  }
  if (!file.endsWith(".js")) continue;
  for (const { text } of importsIn(
    readFileSync(file, "utf8"),
    file,
    ts.ScriptKind.JS
  )) {
    if (text.startsWith(".") || isBuiltin(text)) continue;
    fail(
      `${rel} imports "${text}", which nobody installs — the bundle has to ` +
        `be self-contained, and a bare import in it is a dependency that ` +
        `escaped esbuild`
    );
  }
}

// --- 5. what esbuild compiled in --------------------------------------------

/**
 * Every package the lockfile puts under one of {@link BUNDLED}, transitively.
 *
 * Derived rather than listed, so a clack patch that adds a dependency of its
 * own does not fail this gate for no reason — while `prettier` or `typescript`
 * turning up inside the bundle still does.
 *
 * Dependencies and optional dependencies, never peers: a peer is something a
 * consumer is expected to provide, so one of those compiled into our bin is
 * precisely the surprise worth stopping on.
 */
function bundledClosure(lock) {
  const entryFor = (name) =>
    lock.packages?.[`node_modules/${name}`] ??
    Object.entries(lock.packages ?? {}).find(([key]) =>
      key.endsWith(`/node_modules/${name}`)
    )?.[1];

  const seen = new Set();
  const queue = [...BUNDLED];
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = entryFor(name);
    if (entry === undefined) {
      fail(`package-lock.json has no entry for "${name}"; run \`npm install\``);
      continue;
    }
    queue.push(
      ...Object.keys(entry.dependencies ?? {}),
      ...Object.keys(entry.optionalDependencies ?? {})
    );
  }
  return seen;
}

const metaPath = path.join(root, "build-meta.json");
let bundleSize = 0;
const compiled = new Set();
if (!existsSync(metaPath)) {
  fail("build-meta.json does not exist — run `npm run build`");
} else {
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const allowed = bundledClosure(
    JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"))
  );
  // By package rather than by file: a package arrives in the bundle as a
  // dozen modules, and one line about it is the whole news.
  for (const input of Object.keys(meta.inputs ?? {})) {
    const at = input.lastIndexOf("node_modules/");
    if (at < 0) continue;
    compiled.add(packageOf(input.slice(at + "node_modules/".length)));
  }
  for (const name of compiled) {
    if (allowed.has(name)) continue;
    fail(
      `dist/cli.js has "${name}" compiled into it, which is not ` +
        `${BUNDLED.join(", ")} or anything the lockfile puts under it`
    );
  }
  for (const [file, out] of Object.entries(meta.outputs ?? {})) {
    if (binTargets.has(path.normalize(file))) bundleSize = out.bytes ?? 0;
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
  `✓ ${pkg.name}: ${shipped} shipped modules, one ${Math.round(
    bundleSize / 1024
  )} kB bin, ${compiled.size} package(s) compiled in ` +
    `(${[...compiled].sort().join(", ")}), every import a node builtin, ` +
    `and nothing for a user to install`
);
