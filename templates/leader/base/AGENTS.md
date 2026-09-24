# AGENTS.md — working on this Leader

A Dynamic Agents Leader: one agent, the A2A tenant `leader`, in one Worker. It
composes [`@dynamicagents/core`](https://github.com/dynamicagents/core) (the
mandatory foundation) and
[`@dynamicagents/plugins`](https://github.com/dynamicagents/plugins) (optional
capabilities).

The single most useful thing to know: **almost nothing here is framework.** The
round loop, the durable Subtask rows, the concurrent fan-out, the subagent
execution, the Durable Object body and the task lifecycle are all in core. What
lives here is what core deliberately refuses to ship — the words, the config
values, and which plugins the agent installs. `src/workspace/` holds only
config, addresses and adapters for the workspace this Worker deploys; the object
itself is `@dynamicagents/plugins/computer`.

---

## Where a thing goes

| You are changing…                         | It goes in                              |
| ----------------------------------------- | --------------------------------------- |
| what the model is told about a domain     | the plugin that owns that domain        |
| what the agent _is_                       | `src/agents/leader/soul.ts`             |
| how a round ends, or a user-facing string | `src/round-policy.ts`                   |
| which capabilities the agent has          | `src/agents/leader/plugins.ts`          |
| model ids, budgets, limits                | `src/config.ts`                         |
| what the subtask harness changes          | `src/harness.ts`                        |
| a secret                                  | `.env`, then `npm run deploy`           |
| the object a capability runs in           | **`@dynamicagents/plugins`** — not here |
| cancellation, retries, idempotency, DAGs  | **`@dynamicagents/core`** — not here    |

**The tenant id is a public identifier.** A gatekeeper registers against it and
it rides in a JWT claim, so renaming it is a re-registration, not a refactor.

---

## Working here

```bash
npm run check              # wrangler types, prettier, eslint, tsc, comment path refs
npm test                   # vitest, inside real workerd
npm run deploy -- --dry-run --outdir dist
```

`npm test` alone will not catch a type error — vitest transpiles specs without
typechecking them — so run `check` before pushing. After changing
`wrangler.jsonc`, run `npm run types` and commit the regenerated
`worker-configuration.d.ts`: a fresh clone has to typecheck without running a
script.

**A migration tag is applied once, ever.** A class appended to a tag that is
already deployed is never created. Add a new tag for every change to
`migrations` in `wrangler.jsonc`; the comment there has the rest.

---

## Comments

This project comments heavily, and that is deliberate: a lot of what is here
was expensive to learn and invisible in the code. The cost is that comments rot,
so they are held to the same bar as the code.

A comment states a **constraint, a measurement, or a coupling** — something that
changes a decision. Not what changed, not when, not what a previous version
said; `git log` owns that.

- **No changelog.** "This used to…" is history. Write the rule that survives
  it. A measurement is worth keeping; the date it was taken is not.
- **No package versions or dates** in prose. They are stale on the next bump
  and nothing checks them.
- **One home per fact.** Put the explanation in the file somebody edits when
  they change that behaviour, and a pointer everywhere else.
- **No counts.** Name the thing, not how many there are.
- **Cross-file references name a real path**, and `npm run check` fails one
  that does not exist.

If a comment is longer than the code it explains, ask what decision it is
protecting.
