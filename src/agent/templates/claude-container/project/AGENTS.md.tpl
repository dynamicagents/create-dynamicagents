# AGENTS.md: working in `claude-container`

One Worker, one agent. `Claude Container` is a **tenant** of this deployment,
reached over A2A at `/a2a` with `params.tenant` set to `claude-container`.

It hands work to Claude Code. Its own model, on Workers AI, opens a scratchpad,
briefs, checks and replies; it has no shell and no editor. Every write is a
**Claude Code session's**: a `claude -p` process in a sandbox container, reached
on a Claude subscription credential that never enters the container. A file a
session made reaches the person as a link, through `share_file`.

Almost nothing here is framework. The turn is [`@cloudflare/think`][think]'s;
the A2A task, the workflow that runs its steps, the step job and delegation to
sub-agents are [`@dynamicagents/core`][core]'s; the sandbox object, its egress,
the scratchpad and the Claude Code session are
[`@dynamicagents/plugins`][plugins]'. What lives here is what those deliberately
refuse to ship: the words, the numbers, the capabilities this agent has, and
which steps its task runs.

[think]: https://www.npmjs.com/package/@cloudflare/think
[core]: https://github.com/dynamicagents/core
[plugins]: https://github.com/dynamicagents/plugins

**A paid Cloudflare Workers plan is a requirement**, not a recommendation:
Containers$BROWSER_TOO are not on the free tier.

---

## Where a thing goes

| You are changing…                                         | It goes in                                |
| --------------------------------------------------------- | ----------------------------------------- |
| how the agent works: when it delegates, checks, shares    | `src/agents/claude-container/soul.ts`     |
| what the coordinator can do itself                        | `src/agents/claude-container/plugins.ts`  |
| a session: its spec, its brief, what the agent hears      | `src/agents/claude-container/children.ts` |
| what it advertises to a gatekeeper                        | `src/agents/claude-container/manifest.ts` |
| the steps its task runs                                   | `src/agents/claude-container/workflow.ts` |
| model ids, compaction, the sandbox's size, session limits | `src/config.ts`                           |
| the image, the pinned Claude Code version, every binding  | `Dockerfile`, `wrangler.jsonc`            |
| how the sandbox and its scratchpad are addressed          | `src/workspace/`                          |
| what a person reads when a task ends badly                | `src/copy.ts`                             |
| what the model is told about a domain                     | the plugin that owns that domain          |
| cancellation, recovery, idempotency, delegation           | **`@dynamicagents/core`**, not here       |
| the Durable Object a capability runs in                   | **`@dynamicagents/plugins`**, not here    |

If you find yourself writing durable-execution logic here, that is the signal it
belongs in core instead. If you find yourself writing the object a container
lives in, its alarm or its install, it belongs in plugins: `src/workspace/`
holds only config, addresses and adapters for the sandboxes this Worker deploys.

---

## Working here

```bash
npm run keygen   # one signing key for this deployment; see .env.example
npm run check    # wrangler types, prettier, eslint, tsc (src and test), the container pins
npm test         # vitest, inside real workerd
npm run dev      # local
npm run deploy   # builds the daemon and the image, then the Worker
```

`npm test` alone will not catch a type error, because vitest transpiles specs
without typechecking them, so run `check` before you push. `check` starts with
`wrangler types --check`, which fails on a stale `worker-configuration.d.ts`:
run `npm run types` after any change to `wrangler.jsonc`.

### The tests, and what each is for

| file                            | what it pins                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `test/edge.spec.ts`             | The zero-trust edge with no model involved: the signed card, the JWKS, and what an unauthenticated call gets.      |
| `test/claude-container.spec.ts` | A task through the real host and workflow on a scripted session, the refusal with no scratchpad, and `share_file`. |

Nothing in the suite reaches a real model or starts a container:
`test/worker.ts` is this Worker with the agent's and the sessions' models
swapped for scripted ones and the sandbox over a container that stays stopped.
What the sandbox does with a running container is plugins' to test.

---

## The Claude Code version is pinned

The image installs one Claude Code version, `CLAUDE_CODE_VERSION` on the
container entry in `wrangler.jsonc`, because plugins' egress gateway and stream
parser are written against one version's traffic. `npm run check` fails when
the pin differs from the version `@dynamicagents/plugins/claude-code` verified
(`scripts/verify-container-env.mjs`). Move it only to a version a plugins
release has verified, in the same change as the plugins bump.

The daemon in the image is built from this project's own dependencies before
every deploy and dev run (`scripts/build-daemon.mjs`), so the object and the
daemon speak one `agents` version.

---

## Things that are easy to get wrong

**1. Cancellation is decided by the guarded write, never by a probe.** Core's
task ledger flips a task to `canceled` in one guarded write, and every later
write is refused against it and says so. Read those answers. A hook written
here, `onTaskSettled` or a spec's `settle`, runs after the flip and acts on it;
it never decides it.

**2. A migration tag is applied once, ever.** Anything appended to a tag already
deployed is never applied, and the failure surfaces at the first request or at
the next deploy. Always add a new tag; `wrangler.jsonc` carries the detail,
including what it takes to actually free a deleted class's storage. A new class
takes a name no deployment has used, because a namespace is keyed by class
name.

**3. The scratchpad is the only copy.** What a session made lives in the
sandbox until it is shared, and the weekly sweep empties a sandbox nobody has
used for `SANDBOX_RECLAIM_MS`, backups included. Share what should be kept.

---

## Adding a second agent to this Worker

Everything specific to this agent is in `src/agents/claude-container/`, and every
class, binding and workflow name derives from the tenant id, so another agent
with a different tenant id cannot collide with it. Unlike a generated generic
agent, this one also reaches outside its directory: `src/config.ts`,
`src/workspace/`, `src/sandbox-daemon.ts`, the `Dockerfile` and `scripts/`. Bring
those along whole, mount the second agent in `src/index.ts`, add its bindings and
a **new** migration tag in `wrangler.jsonc`, union `package.json` and
`.env.example`, and merge `test/worker.ts` and `vitest.config.ts` rather than
copying them. Then `npm run types && npm run check && npm test`.

**A merge does not move state.** Every task, conversation and scratchpad
the agent had belongs to the Worker it was deployed as; in the merged Worker it
starts empty.

A tenant id is a public identifier: a gatekeeper registers against it and it
rides in a JWT claim, so renaming one is a re-registration, not a refactor. Pick
the directory and the id once.
