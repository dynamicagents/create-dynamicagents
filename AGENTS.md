# AGENTS.md — working in `create-dynamicagents`

The CLI behind `npm create dynamicagents@latest`. npm maps `npm create <name>`
to the package `create-<name>` and runs its `bin`, so the package name and the
bin name are the command: renaming either breaks it.

It runs on a user's machine before anything of theirs is installed, and that
sets the rules:

- **Only `dependencies` reach the user.** `npm create` installs the package
  without its devDependencies, so importing one works here and throws
  `ERR_MODULE_NOT_FOUND` there. `scripts/verify-package.mjs` fails the build on
  it.
- **A Node program, not a Worker.** Unlike the rest of the train it builds with
  `module: NodeNext` and `types: ["node"]`. `engines` and `@types/node` follow
  starter's Node, since what this scaffolds needs that Node anyway.
- **Logic stays out of `src/cli.ts`.** The bin only reads its arguments, asks,
  and prints; what it asks and prints comes from pure functions and data a
  spec can reach without a process.

---

## What it writes, and why that is pinned

`src/agent/` holds the whole generator: `files.ts` lists a project as data, and
`templates/` is one pure function per generated file. There is nothing to derive
a scaffold from at run time — `starter` is archived, and was never published —
so this package carries the code it writes, prompt copy included.

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
npm run check              # prettier, eslint, tsc, build
npm test                   # vitest
npm run verify:package     # the publish gate — read it before changing it
node dist/cli.js           # after a build, what a user sees
```

`npm test` alone will not catch a type error; vitest transpiles specs without
typechecking them.

None of those installs anything, so none of them proves a generated project
works. That is one command, and worth running after a change to a template:

```bash
node dist/cli.js agent generic /tmp/demo \
  --name demo --description "A demo agent" --yes
cd /tmp/demo && npm run check && npm test
npx wrangler deploy --dry-run --outdir dist
```

`.github/workflows/scaffold.yml` runs exactly that on every pull request, and
again weekly against core and plugins at their default branches.

---

## Publishing

A version bump reaching `main` is what ships it: on the first green Test run for
a commit carrying that version, `.github/workflows/release.yml` publishes to npm
over OIDC and only then cuts the tag. A merge without a bump ships nothing, so
changes batch on `main` until a PR that bumps the version.

Bump with `npm version patch` or `npm version minor`, not by hand: editing
`version` directly leaves `package-lock.json` behind, and `npm ci` does not say
so.
