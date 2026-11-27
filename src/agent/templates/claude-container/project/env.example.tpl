# Copy to `.env` for local `wrangler dev`. In production set each as a secret:
# `wrangler secret put <NAME>`, or `wrangler deploy --secrets-file .env`.
#
# Wrangler loads `.env`, then `.env.local`, then (when you pass `--env <name>`)
# `.env.<name>` and `.env.<name>.local`, each overriding the last. So a staging
# deployment is `.env.staging`, not an edit to wrangler.jsonc. Everything but
# this example file is gitignored.
#
# One caveat: if a `.dev.vars` file exists it wins outright and none of the
# above is read. This project uses `.env`; keep a single file so there is never
# a question which one is live.

# One Ed25519 private JWK, on a single line, signing the card this Worker serves
# and every push-notification callback JWT. It MUST include a `kid`. Generate
# one with `npm run keygen`.
#
# Only the matching PUBLIC key is ever exposed, at /.well-known/jwks.json: the
# private half never leaves the Worker, and is never configured anywhere else,
# because the Worker derives the public half from it.
A2A_SIGNING_KEY=

# JSON array of the gatekeeper origins this deployment accepts calls from, e.g.
# ["https://gatekeeper.example.com"]. A property of this deployment, like the
# key. Not a traditional secret, but kept out of wrangler.jsonc so it can differ
# per environment with no code change.
GATEKEEPER_ORIGINS=

# There is no credential here for the agent's own model, deliberately.
#
# The agent's turn runs on Workers AI through the `AI` binding, which Cloudflare
# authenticates for the Worker (`src/config.ts`). A slug from AI Gateway's
# provider catalog works over the same binding, billed to the account's AI
# Gateway balance. There is no key to store and none to rotate, and no AI
# Gateway token either: the binding does not send one. A gateway `401`
# means Authenticated Gateway is switched on for the `default` AI Gateway every
# call goes through: switch it off.
#
# The `CLAUDE_CODE_OAUTH_TOKEN_*` entries at the bottom are not an exception to
# this: they authenticate the Claude Code CLI running inside the sandbox's
# container, not any loop in this Worker, and no container ever sees one.

# CLAUDE_CODE_OAUTH_TOKEN_1 / _2 / _3: the credential pool the egress gateway
# draws on, in priority order. Each is a `claude setup-token` OAuth credential:
# a Claude **subscription**, not an API key, because a subscription is refused
# for raw Messages API calls on every frontier model and accepted from the
# sanctioned Claude Code client.
#
# The egress gateway uses the first entry until Anthropic answers 429, then
# advances to the next, and once every entry is spent it reports the earliest
# reset time and stops. Rotating any of these secrets works as you would expect:
# spent and rejected state is keyed on a fingerprint of the credential rather
# than on its position, so a freshly minted token is tried immediately instead
# of inheriting the state of the one it replaced.
#
# **None of them ever enters the container.** They are read only by the egress
# entrypoint, which leases one from the sandbox's pool and swaps it into the
# outbound request on the Worker side of the boundary; the session itself
# launches with a placeholder. That is what keeps them out of reach of any
# package a session installs and of any shell the model drives.
#
# Running on fewer, or adding one, is the same edit here, in `secrets.required`
# in wrangler.jsonc, *and* in the pool in
# `src/agents/claude-container/claude-code.ts`: a name declared and left unset is
# typed as a definite string that is undefined at runtime, and warns on every
# local run.
#
# Note the caveat: these are deployment-wide, so one person's subscription backs
# everyone using this deployment. Fine for a single operator; read Anthropic's
# terms before pointing a multi-tenant gatekeeper at it.
CLAUDE_CODE_OAUTH_TOKEN_1=
CLAUDE_CODE_OAUTH_TOKEN_2=
CLAUDE_CODE_OAUTH_TOKEN_3=

# There is deliberately nothing else here. Everything the Worker reads is above;
# `wrangler.jsonc` holds the bindings, which are not secrets.
