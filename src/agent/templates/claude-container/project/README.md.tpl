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
npm run keygen     # prints this deployment's signing key: paste it into .env
```

Fill in `.env`: the signing key, the gatekeeper origins you accept calls from,
and the Claude Code credential pool. [`.env.example`](.env.example) says what
each one is.

```bash
npm run check      # types, format, lint, typecheck, the container pins
npm test           # the suite, in real workerd, on a scripted model (Docker)
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

## Claude Code in the container

The sessions run the Claude Code CLI inside the sandbox's container, on a Claude
subscription rather than an API key.

1. **Mint a credential.** On a machine where Claude Code is installed and signed
   in to the subscription, run:

   ```bash
   claude setup-token
   ```

   It prints a long-lived OAuth token: put it in `.env` as
   `CLAUDE_CODE_OAUTH_TOKEN_1`. Another subscription goes in the next entry, and
   is used once Anthropic answers the one before it with a `429`. Running on
   fewer entries, or adding one, is the edit `.env.example` spells out.

2. **Have Docker running.** `npm run dev`, `npm run deploy` and `npm test` all
   build the container image from the `Dockerfile`, with the Claude Code
   version `wrangler.jsonc` pins, so each needs a Docker daemon on the machine.

3. **Choose what a session runs on.** `CLAUDE_CODE_SESSION` in `src/config.ts`
   sets every session's model, effort and time limit. Any id Claude Code's own
   `--model` takes works there.

To see it work under `npm run dev`, ask the agent for something it has to run,
such as a script and the file it writes: `docker ps` shows the sandbox's
container start, and the reply links the file.

The token never enters the container. The egress gateway swaps it in for a
placeholder on the Worker side, so nothing a session runs can read it. The
pinned version moves only to one a plugins release has verified:
[`AGENTS.md`](AGENTS.md) says how.

---

## Talking to it locally

`npm run dev` serves the agent at `http://localhost:8787`, and nothing reaches
it without a gatekeeper's token. The token names the URL of the key that
verifies it (`jku`), and the agent fetches that key only over HTTPS and only
from an origin in `GATEKEEPER_ORIGINS`. So a gatekeeper on your own machine
needs an HTTPS tunnel in front of it:

```bash
cloudflared tunnel --url http://localhost:<gatekeeper-port>
```

Then:

1. Put the URL it prints in `.env`:
   `GATEKEEPER_ORIGINS=["https://<name>.trycloudflare.com"]`.
2. Give the gatekeeper that same URL as its own origin, the one its tokens name.
3. Register `http://localhost:8787/a2a` with it, tenant `claude-container`.
4. Restart `npm run dev`, which reads `.env` only when it starts.

A quick tunnel gets a new URL every time it starts, and both `.env` and the
gatekeeper have to follow it.

## When something goes wrong

A failed task tells the caller one line, `failed` in `src/copy.ts`, and never
why: the reason is in the terminal running `npm run dev`.

| what you see                                                                                                              | why                                                                                                    | what to do                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `500` on every request, `/.well-known/agent-card.json` included, with `Unexpected end of JSON input` at `parsePrivateJwk` | `A2A_SIGNING_KEY` is empty: `npm run keygen` prints the key and writes nothing                         | Paste the line it prints into `.env`, then restart                                             |
| `401` on every call                                                                                                       | The gatekeeper's origin is not in `GATEKEEPER_ORIGINS`, or its keys cannot be fetched from that origin | Make the tunnel's URL, the gatekeeper's origin and `GATEKEEPER_ORIGINS` the same, then restart |
| Every task fails at once, with `AiError: Model … is not available on the Workers Free plan`                               | The account wrangler is signed in to is on the free plan                                               | Move it to Workers Paid, or `npx wrangler login` to the account that is                        |
| Every task fails at once, with an AI Gateway error, on a `"<provider>/<model>"` model                                     | The `default` gateway has no key for that provider and no credits                                      | Store the provider's key on it, alias `default`, or add credits                                |
| The reply says no Anthropic credential is configured                                                                      | Every `CLAUDE_CODE_OAUTH_TOKEN_*` is empty                                                             | `claude setup-token`, then restart                                                             |
| The reply says every credential has reached its limit                                                                     | Each subscription's bucket is spent until its reset                                                    | Wait for the reset the reply names, or add a subscription                                      |
| `npm run dev` or `npm test` fails building the image, or a session never starts                                           | No Docker daemon is running                                                                            | Start Docker, then `npm run dev`                                                               |
| An edit to `.env` changes nothing                                                                                         | `npm run dev` was not restarted, or a `.dev.vars` exists, and wrangler then ignores `.env`             | Restart, and keep one of the two files                                                         |

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
