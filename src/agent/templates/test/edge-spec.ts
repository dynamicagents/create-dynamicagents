import type { AgentSpec } from "../../spec.js";

/**
 * `test/edge.spec.ts` — the zero-trust edge, with no model involved.
 *
 * It drives the **production** Worker (`src/index.ts`), not the scripted one:
 * nothing here reaches a Durable Object, so there is nothing to stub.
 */
export const edgeSpec = (
  spec: AgentSpec
): string => `import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import {
  AGENT_ORIGIN,
  createAgentHarness,
  TEST_AGENT_PRIVATE_JWK
} from "@dynamicagents/core/testing";
import worker from "@/index";

/**
 * What the deployment serves before anybody is authenticated, and what it
 * refuses.
 *
 * Every assertion here is about core's edge as **this project** configures it:
 * the card it serves is this project's \`host-manifest.ts\`, the key is the one in
 * \`.env\`, and the tenant is the one \`src/index.ts\` mounts. No model runs, so
 * this is the spec that still passes when a turn is broken.
 */

/** The one tenant this Worker mounts, and the name on its card. */
const TENANT = "${spec.tenant}";
const NAME = ${JSON.stringify(spec.name)};

const harness = createAgentHarness({ worker, env, tenant: TENANT });

const get = (path: string) =>
  worker.fetch(new Request(\`\${AGENT_ORIGIN}\${path}\`), env);

const sendMessage = (tenant: string) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "SendMessage",
  params: { tenant }
});

describe("discovery", () => {
  it("serves one signed stub card at the well-known path", async () => {
    // One card per origin, because a well-known URI is per-authority (RFC 8615)
    // and A2A registered this path with IANA. The agent's own card comes from
    // \`GetExtendedAgentCard\` below.
    const res = await get(\`/\${AGENT_CARD_PATH}\`);
    expect(res.status).toBe(200);

    const card = await res.json<{
      name: string;
      capabilities: { extendedAgentCard: boolean };
      supportedInterfaces: { url: string; tenant: string }[];
      signatures: { protected: string }[];
    }>();

    // It describes the deployment, and names no tenant.
    expect(card.supportedInterfaces[0]!.tenant ?? "").toBe("");
    expect(card.supportedInterfaces[0]!.url).toBe(\`\${AGENT_ORIGIN}/a2a\`);
    expect(card.capabilities.extendedAgentCard).toBe(true);

    // Signed by this deployment's key, and pointing a verifier at where the
    // public half is served.
    const header = JSON.parse(
      atob(card.signatures[0]!.protected.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { jku: string; alg: string };
    expect(header.jku).toBe(\`\${AGENT_ORIGIN}/.well-known/jwks.json\`);
    expect(header.alg).toBe("EdDSA");
  });

  it("serves the public half of the signing key, and only that", async () => {
    const res = await get("/.well-known/jwks.json");
    expect(res.status).toBe(200);

    const body = await res.json<{ keys: Record<string, unknown>[] }>();
    expect(body.keys[0]!.kid).toBe(TEST_AGENT_PRIVATE_JWK.kid);
    // The private half must never be served.
    expect(body.keys[0]!).not.toHaveProperty("d");
  });

  it("returns the agent's own card for its tenant", async () => {
    using _ = harness.interceptGatekeeper();

    const res = await harness.rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "GetExtendedAgentCard",
      params: { tenant: TENANT }
    });
    const body = await res.json<{
      result: { name: string; supportedInterfaces: { tenant: string }[] };
    }>();

    expect(body.result.name).toBe(NAME);
    expect(body.result.supportedInterfaces[0]!.tenant).toBe(TENANT);
  });
});

describe("what it refuses", () => {
  it("refuses an unauthenticated call", async () => {
    const res = await worker.fetch(
      new Request(\`\${AGENT_ORIGIN}/a2a\`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sendMessage(TENANT))
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("refuses a token minted for another tenant", async () => {
    // Every agent behind one gatekeeper shares an audience, so the tenant claim
    // is what separates them — and this is the assertion that says so. It holds
    // with one agent mounted exactly as it would with several.
    using _ = harness.interceptGatekeeper();

    const res = await harness.rpc(sendMessage(TENANT), {
      token: await harness.token({ tenant: "somebody-else" })
    });
    expect(res.status).toBe(401);
  });
});
`;
