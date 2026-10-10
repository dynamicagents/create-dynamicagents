# create-dynamicagents

Create gates, leaders and agents on
[Dynamic Agents](https://github.com/dynamicagents).

```bash
npm create dynamicagents@latest
```

It asks what you want to build. **Agent** writes a complete, deployable project:
one agent in a Cloudflare Worker of its own, with its own wrangler config,
bindings, migration tag and signing key, reached over A2A as its own tenant.
Gates and leaders are a work in progress; follow them at
[dynamicagents.dev](https://dynamicagents.dev).

Requires Node 24 or later, and a **paid Cloudflare Workers plan**: the models a
generated agent runs on are not served on the free tier, and neither is Browser
Rendering. There is no free-tier path.

## What you get

```
support/
  src/agents/support/   the agent: its soul, plugins, sub-agent, card, pipeline
  src/index.ts          one Worker, this agent mounted as the tenant `support`
  wrangler.jsonc        its own bindings, its own migration v1
  test/                 the A2A lifecycle on a scripted model, and the edge
```

Then `npm run keygen`, fill in `.env`, and `npm run deploy`. The generated
`README.md` carries the rest, and its `AGENTS.md` carries the rules — including
how to bring a second generated agent into the same Worker later.

## Answering without the questions

```bash
npm create dynamicagents@latest agent generic support -- \
  --name support --description "Answers product questions" --yes
```

The `--` is npm's, not ours: without it, npm keeps the flags for itself.

| flag            | what it answers                                                        |
| --------------- | ---------------------------------------------------------------------- |
| `--name`        | The tenant id. Every class, binding and workflow name derives from it. |
| `--description` | One line for the card, and the first line of the soul.                 |
| `--dir`         | Where to write it. Defaults to the name.                               |
| `--model`       | A Workers AI model id. Defaults to one that calls tools reliably.      |
| `--no-subagent` | Leave out the sub-agent it hands research to.                          |
| `--browser`     | Install the browser plugin, its binding and its skill.                 |
| `--yes`         | Do not ask for confirmation.                                           |
| `--dry-run`     | Print what would be written, and write nothing.                        |

## License

Apache 2.0.
