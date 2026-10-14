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
  gate fails an extension; nothing else would, since esbuild takes either. A
  `.tpl` import is the one exception, and names its file in full: it is not a
  module, and the loader is keyed on that suffix.

- **Logic stays out of `src/cli.ts`.** The bin only reads its arguments, asks,
  and prints; what it asks and prints comes from pure functions and data a
  spec can reach without a process. `src/cli/` is where those live — one run of
  the command, from the questions to the install — in opposition to `src/agent/`,
  which is only ever about the project being written. `src/train.ts` is at the
  root with the bin because both halves read it.

  One spec is the exception, and has to be: `src/cli.spec.ts` spawns
  `dist/cli.js` and asserts exit codes and what reaches stdout, because an exit
  code and a stream are what it is about and no pure function has either. It
  builds when `dist/` is missing or older than `src/`, so `npm test` alone still
  works. Everything else stays under the rule — a spec that wants a process to
  tell it about a _string_ is a spec in the wrong place.

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
a template writes reads them — and `templates/` is what a template _reads_
(`text.ts`, `render.ts`, `dependencies.ts`, `merge-notes.ts`), with
`templates/agent|project|test/` the files a template _writes_ — each one a
**pair**: the `.tpl` file holding the text verbatim, and the module that binds
its variation.

### A generated file is a real file

`copy.ts.tpl` _is_ `src/copy.ts`, byte for byte. That is the point: the text
this package writes is TypeScript full of template literals, markdown full of
backticked code spans and JSONC full of comments, and as template literals in
`.ts` it was 475 hand-written `` \` `` escapes with no highlighting, no
prettier, no editor feedback and diffs that showed escapes rather than content.
esbuild's `text` loader puts a `.tpl` into the bundle (`scripts/build.mjs`);
three places have to agree that a `.tpl` is text and all three say so — esbuild
there, vite in `vitest.config.ts`, and `tsc` via `templates/tpl.d.ts`. A `.tpl`
with no loader is a build error, never a silent inclusion, which is why the
extension is its own.

The extension is **role-last** (`copy.ts.tpl`, not `copy.tpl.ts`) so that
`tsconfig.json`, `eslint.config.js` and all five checks in
`scripts/verify-package.mjs` are untouched: a `.tpl` is not `*.ts`, so nothing
typechecks it, lints it or objects to the extension on its import. It costs the
`overrides` block in `.prettierrc` and the lines in `.gitattributes` — the
second of which is load-bearing, because the loader ships what the checkout
holds and a CRLF clone would write CRLF into every generated project.

`templates/render.ts` is how a template varies, and the three forms are written
so that **a template stays valid in the language it writes** — which is what
lets prettier run over it:

- `$UPPER_SNAKE` inline, substituted in one pass. A _name_, a _literal_ (a
  complete quoted literal from `quoted()`, since a description may hold a
  quote), a _phrase_ (a possibly-empty mid-sentence fragment), or a _value_ a
  `text.ts` helper laid out. **A token may not be followed by an uppercase
  letter** — the longest-run match would swallow it.
- `// $block NAME` on a comment line, whose whole line becomes that token's
  text. For the computed pieces. A comment and not a bare `$NAME` line because
  prettier appends a `;` to a class member, appends a `,` to an object
  property, and _collapses_ `[\n$SKILLS\n]`; a comment it leaves where it is.
  And a block cannot stand where the property before it needs a trailing comma,
  since `trailingComma: "none"` strips one before what prettier reads as the
  last property.
- `// $when name` / `// $when !name` / `// $end`, including or dropping what is
  between. **The blank line belongs inside the region** — no generated file has
  two consecutive blank lines, and nothing normalises them, so that convention
  is what makes a dropped region leave exactly one.

Markdown varies by inline token only: prettier splits a list and inserts blank
lines around an `<!-- … -->` between two items, so a region in a `.md.tpl`
would reformat the text it holds.

**The criterion for what may live in a file**: text goes in the `.tpl` when
every variation in it is an inline token at a position whose prettier layout
does not depend on the value, a block, or a whole-region inclusion. It stays
computed — and arrives as a block — when the _structure_ is computed (a varying
number of elements, where which one is last decides the commas) or when
prettier's layout depends on the substituted value: `assigned`, `stringProp`,
`jsonObject`, `mdTable` and a multi-name `namedFrom` all break differently past
the print width. A single-name `namedFrom` never breaks, so those imports are
simply written out.

What holds all of it is the suite that reads `projectFiles` for what it _says_:
`formatting.spec.ts` runs the real prettier over every generated byte across
the print width, `files.spec.ts` pins the exhaustive path list per fixture and
the invariant the regions depend on — no two consecutive blank lines — and
`wrangler.spec.ts`, `names.spec.ts` and `merge-notes.spec.ts` parse what comes
out. **Generated output is deliberately not pinned as bytes.** A digest per
file would fail on every intended change to the text, which is most changes
here, and say only that something moved; none of the scaffolders this one is
measured against pins its output that way either.

That makes the templates **a use of core's published class contract**. They name
`StepAgent`, `TaskHost`, `TaskWorkflow`, `SubAgent` and `defineAgent`, and the
config files they write are read by wrangler, eslint, tsc and vitest. So neither
set can ask for "latest": `src/train.ts` pins both, and a minor of core means a
diff there and a release here. Nothing validates those pins locally — `npm
install` in a generated project owns semver, and `.github/workflows/scaffold.yml`
is what runs it.

**The compatibility date is one of those pins, not a date somebody picked.**
`WORKERD` names the workerd that `TOOLCHAIN.wrangler`'s floor installs — `npm
view wrangler@<floor> dependencies.workerd` — and `COMPATIBILITY_DATE` is its
release date, derived, because a workerd version _is_ a date and a date is only
honoured by the workerd reading it. So the two move in one edit and cannot drift
apart. `TOOLCHAIN`'s `@cloudflare/vitest-plugin` is the third name in that same
edit: the plugin pins miniflare exactly, miniflare carries a workerd of its own,
and that is the runtime a generated project's `npm test` boots — reading this
same date — so a plugin floor behind `WORKERD` is a project whose tests refuse a
date its deploy accepts. `check-compat-date.mjs` reads the project root's
workerd, which is wrangler's; the `npm test` leg in `scaffold.yml` speaks for
miniflare's. It is pinned rather than chased for the reason create-cloudflare
pins it: workerd refuses a date newer than the runtime reading it, so chasing
the newest release breaks every project installed against an older wrangler.
The pin's own failure is the quiet one — going stale — and
`scripts/check-compat-date.mjs` is the answer, run from `scaffold.yml` because
workerd is only ever a transitive of a _generated_ project's wrangler and there
is nothing local for it to read. Past the pinned date `nodejs_compat` is on by
default, which is why a generated `wrangler.jsonc` declares no
`compatibility_flags` at all; `train.spec.ts` holds that relation so the flag
cannot quietly become necessary again.

Two rules follow, and breaking either is invisible until somebody's first run:

- **Generated output is already formatted.** The first half of a generated
  project's own `npm run check` is a prettier check, and prettier cannot be
  imported at run time — so the layout rules live in
  `src/agent/templates/text.ts`, and `src/agent/formatting.spec.ts` holds them
  to the real prettier, sweeping lengths across the print width because every
  one of those rules is about width. `npm run check` now runs prettier over the
  `.tpl` files too, which is the fast feedback loop; `formatting.spec.ts` over
  the _rendered_ output is still the guarantee, since a `.tpl` is only ever one
  of the shapes it renders into.
- **A capability arrives whole** — the line in `plugins.ts`, the binding in
  `wrangler.jsonc`, the skill on the card. Core checks a plugin's `requires`
  when the agent starts, so two out of three is an agent that throws on its
  first request.
- **A flag arrives whole** too, on this side of the line — the entry in
  `src/cli/args.ts`'s `OPTIONS`, the line in `src/cli/messages.ts`'s `FLAGS`,
  the row in `README.md`. One without the others is a flag that works and
  nothing documents, or one documented and refused; `messages.spec.ts` holds the
  three together.

---

## Working here

```bash
npm run check              # prettier, eslint, tsc (typecheck only), esbuild
npm test                   # vitest
npm run verify:package     # the publish gate — read it before changing it
node dist/cli.js           # after a build, what a user sees
```

`npm test` alone will not catch a type error; vitest transpiles specs without
typechecking them. It does build, though, when `src/cli.spec.ts` finds `dist/`
missing or behind `src/` — that spec runs the real bin, so there is nothing for
it to assert against otherwise. What it runs is `scripts/build.mjs` and nothing
else: one esbuild call, about 50 ms, writing `dist/cli.js` and the
`build-meta.json` beside it that the gate reads.

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
