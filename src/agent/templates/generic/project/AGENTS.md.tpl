# AGENTS.md — working in `$TENANT`

One Worker, one agent. `$NAME` is a **tenant** of this deployment,
reached over A2A at `/a2a` with `params.tenant` set to `$TENANT`.

Almost nothing here is framework. The turn is [`@cloudflare/think`][think]'s;
the A2A task, the workflow that runs its steps, the step job and delegation to
sub-agents are [`@dynamicagents/core`][core]'s; optional capabilities are
[`@dynamicagents/plugins`][plugins]. What lives here is what those deliberately
refuse to ship — the words, the numbers, the capabilities this agent has, and
which steps its task runs.

[think]: https://www.npmjs.com/package/@cloudflare/think
[core]: https://github.com/dynamicagents/core
[plugins]: https://github.com/dynamicagents/plugins

**A paid Cloudflare Workers plan is a requirement**, not a recommendation: the
model this agent runs on is not served on the free tier$BROWSER_TOO. There is
no free-tier path in this project.

---

## Where a thing goes

$WHERE_TABLE

If you find yourself writing durable-execution logic here, that is the signal it
belongs in core instead.

**The soul is yours.** Core ships no prompt copy at all, deliberately: a run
must never execute under an identity nobody chose. `soul.ts` was seeded from one
line of description — read it, and make it say what this agent actually is.

---

## Working here

```bash
npm run keygen   # one signing key for this deployment — see .env.example
npm run check    # wrangler types, prettier, eslint, tsc (src and test)
npm test         # vitest, inside real workerd
npm run dev      # local
npm run deploy   # and register the tenant with your gatekeeper
```

`npm test` alone will not catch a type error — vitest transpiles specs without
typechecking them — so run `check` before you push. `check` starts with
`wrangler types --check`, which fails on a stale `worker-configuration.d.ts`:
run `npm run types` after any change to `wrangler.jsonc`.

### The tests, and what each is for

$TESTS_TABLE

Nothing in the suite reaches the network or a real model: `test/worker.ts` is
this Worker with the agent's model swapped for a scripted one, and
`createAgentHarness` from `@dynamicagents/core/testing` drives a turn the way a
gatekeeper does. A spec that wants a real model needs a recorded cassette —
`@dynamicagents/core/testing` ships the recorder; it is deliberately not wired
up here.

---

## Two things that are easy to get wrong

**1. Cancellation is decided by the guarded write, never by a probe.** Core's
task ledger flips a task to `canceled` in one guarded write, and every later
write is refused against it and says so. Read those answers. Calling `getTask`
first and acting second reopens a window in which a cancel lands and the
gatekeeper still gets a `completed` callback.

**2. A migration tag is applied once, ever.** Anything appended to a tag already
deployed is never applied, and the failure surfaces at the first request or at
the next deploy. Always add a new tag — `wrangler.jsonc` carries the detail,
including what it takes to actually free a deleted class's storage.

---

## Adding a second agent to this Worker

This project was generated as one agent in its own Worker, which is what makes
it simple: one bundle, one config, one deployment, and nothing shared with
anybody else's agent. Nothing stops it holding more, though. A tenant is
required on every request either way, so mounting a second agent is additive
rather than a redesign.

Two generated projects merge mechanically because of how they are laid out:
everything specific to an agent is in its own directory, including its numbers;
outside that directory the support files — the toolchain config, `src/copy.ts`,
`src/model.ts` — are identical in every generated project, and what is left is
the short list of wiring points below; and every class, binding and workflow
name derives from the tenant id, so two agents with different tenant ids cannot
collide and nothing has to be renamed.

To bring another generated agent in:

$MERGE_TABLE

Then `npm run types && npm run check && npm test`.

**$MERGE_CAVEAT**

A tenant id is a public identifier: a gatekeeper registers against it and it
rides in a JWT claim, so renaming one is a re-registration, not a refactor. Pick
the directory and the id once.
