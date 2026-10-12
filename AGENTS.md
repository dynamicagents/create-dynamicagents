# AGENTS.md — working in `create-dynamicagents`

The CLI behind `npm create dynamicagents@latest`. npm maps `npm create <name>`
to the package `create-<name>` and runs its `bin`, so the package name and the
bin name are the command: renaming either breaks it.

It runs on a user's machine before anything of theirs is installed, and that
sets the rules:

- **Nothing reaches the user but the bundle.** `npm run build` is esbuild:
  `src/cli.ts` and everything it imports — `@clack/prompts` included — become
  the one file `dist/cli.js`, and `package.json` declares no `dependencies` at
  all, so `npm create` downloads this package and stops. The packages compiled
  in are listed as `BUNDLED` in `scripts/verify-package.mjs`, and adding a line
  there is a decision to ship somebody else's code.

  Bundling **inverts** the old mistake rather than retiring it. Importing a
  devDependency from shipped code used to throw `ERR_MODULE_NOT_FOUND` on the
  user's machine; now esbuild quietly compiles it in and the user gets it. So
  the gate reads the source, not only `dist`, and that check is the load-bearing
  one — see the header of `scripts/verify-package.mjs` for all five.

  "Bundle" means two unrelated things in this repo, and they never meet: this
  one, and wrangler bundling a _generated_ Worker — which is what `src/train.ts`
  is talking about when it says `agents` must never be bundled.

- **A Node program, not a Worker.** `tsc` only typechecks here (`noEmit`), and
  what still sets this package apart from the rest of the train is
  `types: ["node"]` with `engines` and `@types/node` following starter's Node,
  since what this scaffolds needs that Node anyway. The module settings are the
  train's own — `module: ESNext`, `moduleResolution: Bundler` — because nothing
  resolves a specifier in this repo at run time: `dist` is one bundle, so
  esbuild is the only resolver in the path.

  So **relative imports name a file without its extension**, like the projects
  this writes and unlike core, which publishes modules Node resolves itself. The
  gate fails an extension; nothing else would, since esbuild takes either.

- **Logic stays out of `src/cli.ts`.** The bin only reads its arguments, asks,
  and prints; what it asks and prints comes from pure functions and data a
  spec can reach without a process. `src/cli/` is where those live — one run of
  the command, from the questions to the install — in opposition to `src/agent/`,
  which is only ever about the project being written. `src/train.ts` is at the
  root with the bin because both halves read it.

---

## What it writes, and why that is pinned

`src/agent/` holds the whole generator: `files.ts` lists a project as data, and
`templates/` is one pure function per generated file. There is nothing to derive
a scaffold from at run time — `starter` is archived, and was never published —
so this package carries the code it writes, prompt copy included.

Its root is what something outside reaches for: `spec.ts` and `names.ts` are the
vocabulary every layer reads, `files.ts` is the project as data, and every spec
there is a spec on what `projectFiles` returns, which is why they sit beside it.
Below it, `offer/` is the two menus the CLI puts in front of somebody — nothing
a template writes reads them — and `templates/` is what a template _reads_,
with `templates/agent|project|test/` the files a template _writes_.

That makes the templates **a use of core's published class contract**. They name
`StepAgent`, `TaskHost`, `TaskWorkflow`, `SubAgent` and `defineAgent`, and the
config files they write are read by wrangler, eslint, tsc and vitest. So neither
set can ask for "latest": `src/train.ts` pins both, and a minor of core means a
diff there and a release here. Nothing validates those pins locally — `npm
install` in a generated project owns semver, and `.github/workflows/scaffold.yml`
is what runs it.

Two rules follow, and breaking either is invisible until somebody's first run:

- **Generated output is already formatted.** The first half of a generated
  project's own `npm run check` is a prettier check, and prettier cannot be
  imported at run time — so the layout rules live in
  `src/agent/templates/text.ts`, and `src/agent/formatting.spec.ts` holds them
  to the real prettier, sweeping lengths across the print width because every
  one of those rules is about width.
- **A capability arrives whole** — the line in `plugins.ts`, the binding in
  `wrangler.jsonc`, the skill on the card. Core checks a plugin's `requires`
  when the agent starts, so two out of three is an agent that throws on its
  first request.

---

## Working here

```bash
npm run check              # prettier, eslint, tsc (typecheck only), esbuild
npm test                   # vitest
npm run verify:package     # the publish gate — read it before changing it
node dist/cli.js           # after a build, what a user sees
```

`npm test` alone will not catch a type error; vitest transpiles specs without
typechecking them. `npm run build` is the bundle and nothing else — it is
`scripts/build.mjs`, it takes about 50 ms, and it writes `build-meta.json`
beside `dist` for the gate to read.

None of those installs anything, so none of them proves a generated project
works. That is one command, and worth running after a change to a template:

```bash
node dist/cli.js agent generic /tmp/demo \
  --name demo --description "A demo agent" --yes
cd /tmp/demo && npm run check && npm test
npx wrangler deploy --dry-run --outdir dist
```

`.github/workflows/scaffold.yml` runs exactly that on every pull request, with
core and plugins installed from their default branches. The train releases in
order — core, then plugins, then this package — so those tips are the contracts
the templates are written against, and what a user installs once this publishes.

---

## Publishing

A version bump reaching `main` is what ships it: on the first green Test run for
a commit carrying that version, `.github/workflows/release.yml` publishes to npm
over OIDC and only then cuts the tag. A merge without a bump ships nothing, so
changes batch on `main` until a PR that bumps the version.

Bump with `npm version patch` or `npm version minor`, not by hand: editing
`version` directly leaves `package-lock.json` behind, and `npm ci` does not say
so.
