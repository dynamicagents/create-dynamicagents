# Leader

A [Dynamic Agents](https://github.com/dynamicagents) Leader on Cloudflare
Workers.

A Leader is one agent with many instances. Your gatekeeper reaches it at this
Worker's domain, and each caller it verifies — a person, a channel, an API
client — gets an instance of its own, with its own memory, workspace and tasks.
Give it a repository and a change to make: it clones the repository into a
container, delegates the work to its subagents, reviews what they did, and
opens a pull request.

It runs on [`@dynamicagents/core`](https://github.com/dynamicagents/core) and
[`@dynamicagents/plugins`](https://github.com/dynamicagents/plugins).

## What it needs

- A Cloudflare account on the **Workers Paid** plan, for the container and
  Browser Rendering, with the domain in `wrangler.jsonc`'s `routes` on it.
- **Docker** running wherever you deploy from: `npm run deploy` builds the
  container image locally.
- Node 24 or later.
- The secrets in [`.env.example`](.env.example), which documents each one.

## Deploy

```bash
npm install
npm run keygen      # prints A2A_SIGNING_KEY for .env
npm run deploy
```

Put every secret in `.env` first — `.env.example` lists them. `npm run deploy`
uploads `.env` with each deploy, so changing a secret is an edit there and
another deploy. It also creates anything the Worker binds that wrangler does not
provision, and refuses to replace a Worker of the same name that is not this
project's; [`scripts/deploy.mjs`](scripts/deploy.mjs) has the details.

The route is a custom domain. If that hostname is already attached to another
Worker, wrangler asks before moving it here — and moves it without asking when
nobody is at the terminal to answer.

## Register it with your gatekeeper

| endpoint                    | tenant id |
| --------------------------- | --------- |
| `https://<your-domain>/a2a` | `leader`  |

The tenant is `leader` whatever this project is called: the domain is what
tells one leader from another. The gatekeeper pins the key it finds at
`/.well-known/jwks.json` when it registers the agent.

## Run it locally

```bash
npm run dev
```

`wrangler dev` reads the same `.env`. Workers AI and Vectorize have no local
mode, so model calls and recall reach your account even locally.

## Make it yours

| You are changing…                         | It goes in                        |
| ----------------------------------------- | --------------------------------- |
| what the agent _is_                       | `src/agents/leader/soul.ts`       |
| which capabilities it has                 | `src/agents/leader/plugins.ts`    |
| model ids, budgets, limits                | `src/config.ts`, `src/harness.ts` |
| how a round ends, or a user-facing string | `src/round-policy.ts`             |
| what its card tells a gatekeeper          | `src/agents/leader/manifest.ts`   |

```bash
npm run check    # wrangler types, prettier, eslint, tsc, comment path refs
npm test         # vitest, inside real workerd
```

## Observability

`npm run cf` reads your Worker's logs, workflows, AI Gateway calls and
containers through the Cloudflare API. It takes its own credentials, from
`.cf.env` — see [`.cf.env.example`](.cf.env.example).
