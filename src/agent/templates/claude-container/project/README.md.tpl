# Claude Container

Gets a task done with Claude Code sessions running in a container with a full
shell, and shares the files they make as links.

A Dynamic Agent on Cloudflare Workers, built on
[`@dynamicagents/core`](https://github.com/dynamicagents/core) and
[`@dynamicagents/plugins`](https://github.com/dynamicagents/plugins), scaffolded
with `npm create dynamicagents`.

- **A parent and its sessions.** The agent itself runs on a Workers AI model and
  writes nothing: it opens a scratchpad, briefs a session, checks what came back
  and replies. The work is done by Claude Code sessions in a sandbox container.
- **Files come back as links.** A file a session made is filed as a page with
  `share_file`, and the agent replies with its link.
- **No credential enters the container.** The Claude subscription credential is
  swapped in on the Worker side, on the way out.
- **One Worker, one agent.** This deployment serves exactly this agent, as the
  A2A tenant `claude-container`, with its own wrangler config, bindings and
  signing key.

> **A paid Cloudflare Workers plan is required.** There is no free-tier
> configuration of this project. The sessions need at least one Claude
> subscription credential (`claude setup-token`).

Need it to work on GitHub repositories and carry changes to pull requests? The
Dynamic Agents examples have a PR coordinator built on this same agent.

---

## Quick start

```bash
npm run keygen     # one Ed25519 key for this deployment
```

Fill in `.env`: the signing key, the gatekeeper origins you accept calls from,
and the Claude Code credential pool. [`.env.example`](.env.example) says what
each one is.

```bash
npm run check      # types, format, lint, typecheck, the container pins
npm test           # the suite, in real workerd, on a scripted model
npm run dev        # local
```

Before the first deploy, create the bucket the sandbox backs its scratchpad up
to (its name is in `wrangler.jsonc`):

```bash
npx wrangler r2 bucket create claude-container-sandbox-backups
```

To ship, set the same secrets with `wrangler secret put` (or push the file with
`npx wrangler deploy --secrets-file .env`) and:

```bash
npm run deploy     # builds the sandbox daemon, the image, and the Worker
```

Then register the agent with your gatekeeper:

| endpoint                    | tenant id          |
| --------------------------- | ------------------ |
| `https://<your-worker>/a2a` | `claude-container` |

A tenant is required on every request: there is no default agent and no
implicit routing. The card at `/.well-known/agent-card.json` describes the
deployment; the agent's own card comes from `GetExtendedAgentCard` with that
tenant id.

**Keep one origin.** Core derives the card's URL, its `jku` and the token
audience from the origin a request arrives on, so a second origin advertises a
second audience and a token minted for one will not verify against the other.
`wrangler.jsonc` says what to change when you move to a domain of your own.

---

## The files you will actually edit

| file                                                                                 | what it decides                                                       |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [`src/agents/claude-container/soul.ts`](src/agents/claude-container/soul.ts)         | How the agent works: when it delegates, how it checks, what it sends. |
| [`src/agents/claude-container/children.ts`](src/agents/claude-container/children.ts) | What a Claude Code session is told, and what the agent hears back.    |
| [`src/agents/claude-container/plugins.ts`](src/agents/claude-container/plugins.ts)   | What the agent can do itself.                                         |
| [`src/agents/claude-container/manifest.ts`](src/agents/claude-container/manifest.ts) | What it advertises to a gatekeeper.                                   |
| [`src/config.ts`](src/config.ts)                                                     | Its model, the sessions' model and limits, the sandbox's size.        |
| [`wrangler.jsonc`](wrangler.jsonc)                                                   | The container image, the pinned Claude Code version, every binding.   |

[`AGENTS.md`](AGENTS.md) is the rest: where everything goes, what the tests pin,
the invariants worth knowing, and how to move the pinned Claude Code version.

## License

Yours.
