# $NAME

$DESCRIPTION

A Dynamic Agent on Cloudflare Workers: zero-trust A2A, a durable task
lifecycle, and one continuous, self-compacting conversation per caller. Built on
[`@dynamicagents/core`](https://github.com/dynamicagents/core), scaffolded with
`npm create dynamicagents`.

- **One Worker, one agent.** This deployment serves exactly this agent, as the
  A2A tenant `$TENANT`.$DELEGATION$CAPABILITIES- **Its own everything.** Its own wrangler config, its own bindings, its own
  signing key. Nothing it does can affect another agent.

> **A paid Cloudflare Workers plan is required.** The model this agent runs on is
> not served on the free tier$BROWSER_NOTE. There is no free-tier
> configuration of this project.

---

## Quick start

```bash
npm run keygen     # one Ed25519 key for this deployment
```

Put the private JWK in `.env` as `A2A_SIGNING_KEY`, and the gatekeeper origins
you accept calls from in `GATEKEEPER_ORIGINS`. [`.env.example`](.env.example)
says what each one is.

```bash
npm run check      # types, format, lint, typecheck
npm test           # the suite, in real workerd
npm run dev        # local
```

To ship, set the same secrets with `wrangler secret put` (or push the file with
`npx wrangler deploy --secrets-file .env`) and:

```bash
npm run deploy
```

Then register the agent with your gatekeeper:

$REGISTRATION

A tenant is required on every request — there is no default agent and no
implicit routing. The card at `/.well-known/agent-card.json` describes the
deployment; the agent's own card comes from `GetExtendedAgentCard` with that
tenant id.

**Keep one origin.** Core derives the card's URL, its `jku` and the token
audience from the origin a request arrives on, so a second origin advertises a
second audience and a token minted for one will not verify against the other.
`wrangler.jsonc` says what to change when you move to a domain of your own.

---

## The files you will actually edit

$FILES_TABLE

[`AGENTS.md`](AGENTS.md) is the rest: where everything goes, what the tests
pin, the two invariants worth knowing, and how to bring a second agent into this
Worker later.

## License

Yours.
