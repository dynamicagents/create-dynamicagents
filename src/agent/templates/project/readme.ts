import { MODELS_URL } from "../../../train.js";
import type { AgentNames, AgentSpec } from "../../spec.js";
import { mdTable } from "../text.js";

/** `README.md` — what this is, how to run it, how to put it in front of people. */
export function readmeMd(spec: AgentSpec, n: AgentNames): string {
  const capabilities = spec.capabilities.includes("browser")
    ? "\n- **Reads web pages**, through Browser Rendering.\n"
    : "";
  const delegation = spec.subAgent
    ? "\n- **Delegates.** Self-contained pieces of a request go to a sub-agent and come back composed into one answer.\n"
    : "";

  const registration = mdTable(
    ["endpoint", "tenant id"],
    [["`https://<your-worker>/a2a`", `\`${spec.tenant}\``]]
  );

  const files = mdTable(
    ["file", "what it decides"],
    [
      [
        `[\`${n.dir}/soul.ts\`](${n.dir}/soul.ts)`,
        "Who the agent is. **Start here** — it was seeded from one line."
      ],
      [
        `[\`${n.dir}/plugins.ts\`](${n.dir}/plugins.ts)`,
        "What it can do. One line per capability."
      ],
      [
        `[\`${n.dir}/tuning.ts\`](${n.dir}/tuning.ts)`,
        `Its model, and when the conversation compacts. Every model id is at ${MODELS_URL}`
      ],
      [
        `[\`${n.dir}/manifest.ts\`](${n.dir}/manifest.ts)`,
        "What it advertises to a gatekeeper."
      ],
      [
        `[\`${n.dir}/workflow.ts\`](${n.dir}/workflow.ts)`,
        "The steps a task runs. One today."
      ],
      [
        "[`src/copy.ts`](src/copy.ts)",
        "What a person reads when a task ends badly."
      ]
    ]
  );

  return `# ${spec.name}

${spec.description}

A Dynamic Agent on Cloudflare Workers: zero-trust A2A, a durable task
lifecycle, and one continuous, self-compacting conversation per caller. Built on
[\`@dynamicagents/core\`](https://github.com/dynamicagents/core), scaffolded with
\`npm create dynamicagents\`.

- **One Worker, one agent.** This deployment serves exactly this agent, as the
  A2A tenant \`${spec.tenant}\`.${delegation}${capabilities}- **Its own everything.** Its own wrangler config, its own bindings, its own
  signing key. Nothing it does can affect another agent.

> **A paid Cloudflare Workers plan is required.** The model this agent runs on is
> not served on the free tier${spec.capabilities.includes("browser") ? ", and neither is Browser Rendering" : ""}. There is no free-tier
> configuration of this project.

---

## Quick start

\`\`\`bash
npm run keygen     # one Ed25519 key for this deployment
\`\`\`

Put the private JWK in \`.env\` as \`A2A_SIGNING_KEY\`, and the gatekeeper origins
you accept calls from in \`GATEKEEPER_ORIGINS\`. [\`.env.example\`](.env.example)
says what each one is.

\`\`\`bash
npm run check      # types, format, lint, typecheck
npm test           # the suite, in real workerd
npm run dev        # local
\`\`\`

To ship, set the same secrets with \`wrangler secret put\` (or push the file with
\`npx wrangler deploy --secrets-file .env\`) and:

\`\`\`bash
npm run deploy
\`\`\`

Then register the agent with your gatekeeper:

${registration}

A tenant is required on every request — there is no default agent and no
implicit routing. The card at \`/.well-known/agent-card.json\` describes the
deployment; the agent's own card comes from \`GetExtendedAgentCard\` with that
tenant id.

**Keep one origin.** Core derives the card's URL, its \`jku\` and the token
audience from the origin a request arrives on, so a second origin advertises a
second audience and a token minted for one will not verify against the other.
\`wrangler.jsonc\` says what to change when you move to a domain of your own.

---

## The files you will actually edit

${files}

[\`AGENTS.md\`](AGENTS.md) is the rest: where everything goes, what the tests
pin, the two invariants worth knowing, and how to bring a second agent into this
Worker later.

## License

Yours.
`;
}
