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
- **Logic stays out of `src/cli.ts`.** The bin only reads its arguments and
  prints; what it prints comes from pure functions a spec can call without a
  process.

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

---

## Publishing

A version bump reaching `main` is what ships it: on the first green Test run for
a commit carrying that version, `.github/workflows/release.yml` publishes to npm
over OIDC and only then cuts the tag. A merge without a bump ships nothing, so
changes batch on `main` until a PR that bumps the version.

Bump with `npm version patch` or `npm version minor`, not by hand: editing
`version` directly leaves `package-lock.json` behind, and `npm ci` does not say
so.
