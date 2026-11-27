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

The CLI itself has no dependencies: `npm create` downloads one package, runs it,
and the only install it then does is the one for the project it wrote.

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

### Which agent

| blueprint          | what it writes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generic`          | A delegating assistant on a Workers AI model, with an optional research sub-agent, `general`, and the browser. Composed from your answers.                                                                                                                                                                                                                                                                                                                                                                 |
| `claude-container` | An agent that hands tasks to Claude Code sessions in a sandbox container and shares the files they make as links. Its sub-agent is the Claude Code session, `claude_code`, which it always has. It asks the generic blueprint's questions except the sub-agent one: its model, and the browser (`--browser`). Its tenant id and description have defaults, and its Claude Code session's model and effort are lines of its own `src/config.ts`, each with a comment saying where to find the alternatives. |

`claude-container` needs Cloudflare Containers and at least one `claude
setup-token` credential; the generated `.env.example` says what each entry is. A
pull-request coordinator built on it, which carries a change through a GitHub
repository to a pull request ready to merge, is one of the Dynamic Agents
examples rather than a blueprint here.

Every install ends by running the project's own prettier over the files it
wrote, and nothing else in the directory. A generic project is written
formatted, so that changes nothing there; a `claude-container` project's files
are laid out for the tenant id they were written with, and this re-lays them out
for yours.

```bash
npm create dynamicagents@latest agent claude-container -- --yes
```

## Answering without the questions

```bash
npm create dynamicagents@latest agent generic support -- \
  --name support --description "Answers product questions" --yes
```

The `--` is npm's, not ours: without it, npm keeps the flags for itself.

| flag            | what it answers                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `--name`        | The tenant id. Every class, binding and workflow name derives from it.                                 |
| `--description` | One line for the agent's card, and for `generic` the first line of its soul.                           |
| `--dir`         | Where to write it. Defaults to the name.                                                               |
| `--model`       | A Workers AI model id. Defaults to one that calls tools reliably.                                      |
| `--no-subagent` | `generic` only: leave out `general`, the sub-agent it hands research to.                               |
| `--browser`     | Install the browser plugin, its bindings and, on a `generic` card, its skill; `--no-browser` for none. |
| `--yes`         | Do not ask for confirmation.                                                                           |
| `--dry-run`     | Print what would be written, and write nothing.                                                        |
| `--help`        | Usage, both ways in, and every flag. Also `-h`.                                                        |
| `--version`     | The version that would run. Also `-v`.                                                                 |

The directory may already exist as long as it is empty. These do not count as
content, so a repository you made with `git init` first is fine, as is one an
editor or Finder has already touched:

`.git` · `.hg` · `.svn` · `.gitkeep` · `.keep` · `.idea` · `.vscode` ·
`.DS_Store` · `Thumbs.db` · `desktop.ini`

The project is written around them: nothing of yours is moved or removed.
Anything else in there and it asks you for a different directory.

A usable answer given up front is not asked for. One that will not do — a tenant
id that could not become a class name, a model id that is not one — is said
where it was given rather than after every other question: the question comes
back with the value in it where there is a terminal, and the run stops naming
the flag where there is not.

## License

Apache 2.0.
