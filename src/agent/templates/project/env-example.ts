import type { AgentSpec } from "../../spec.js";

/** `.env.example` — the two secrets, and why there is no third. */
export const envExample = (
  spec: AgentSpec
): string => `# Copy to \`.env\` for local \`wrangler dev\`. In production set each as a secret:
# \`wrangler secret put <NAME>\`, or \`wrangler deploy --secrets-file .env\`.
#
# Wrangler loads \`.env\`, then \`.env.local\`, then — when you pass \`--env <name>\` —
# \`.env.<name>\` and \`.env.<name>.local\`, each overriding the last. So a staging
# deployment is \`.env.staging\`, not an edit to wrangler.jsonc. Everything but
# this example file is gitignored.
#
# One caveat: if a \`.dev.vars\` file exists it wins outright and none of the
# above is read. This project uses \`.env\`; keep a single file so there is never
# a question which one is live.

# One Ed25519 private JWK, on a single line, signing the card this Worker serves
# and every push-notification callback JWT. It MUST include a \`kid\`. Generate
# one with \`npm run keygen\`.
#
# Only the matching PUBLIC key is ever exposed, at /.well-known/jwks.json — the
# private half never leaves the Worker, and is never configured anywhere else:
# the Worker derives the public half from it.
A2A_SIGNING_KEY=

# JSON array of the gatekeeper origins this deployment accepts calls from, e.g.
# ["https://gatekeeper.example.com"]. A property of this deployment, like the
# key. Not a traditional secret, but kept out of wrangler.jsonc so it can differ
# per environment with no code change.
GATEKEEPER_ORIGINS=

# There is no credential here for the agent's own model, deliberately.
#
# \`${spec.tenant}\` runs its model on Workers AI through the \`AI\` binding, which
# Cloudflare authenticates for the Worker. There is no key to store and none to
# rotate, and no AI Gateway token either: the binding does not send one. A
# gateway 401 means Authenticated Gateway is switched on for the \`default\` AI
# Gateway every call goes through — switch it off.
`;
