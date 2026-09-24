import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import type { PluginHost } from "@dynamicagents/core/host";
import { leader } from "@/agents/leader/definition";

/**
 * What AI Gateway is told about this Worker's model calls, observed on the
 * agent itself.
 *
 * The gateway is shared with whatever else the account runs, so the `agent` key
 * is what says a log row was this agent's spend. Losing it breaks nothing:
 * calls still succeed and the rows simply stop being attributable. So each link
 * is asserted where it is made — the name the Durable Object builds, and the
 * name its subagent facet resolves.
 */

/** The host a Durable Object hands its plugins. `pluginHost` is protected. */
const hostOf = (instance: unknown) =>
  (instance as { pluginHost(): PluginHost<Env> }).pluginHost();

describe("the name the leader's calls are logged under", () => {
  it("is its tenant", async () => {
    const stub = leader.resolveAgent(env, {
      key: `gateway-attribution:${leader.tenant}`
    });
    const name = await runInDurableObject(
      stub,
      (instance) => hostOf(instance).agentName
    );

    expect(name).toBe(leader.tenant);
  });

  /**
   * A facet resolves its own config, and a subagent's calls are most of a
   * delegating agent's spend. The facet binding exists only in this pool — see
   * `vitest.config.ts`.
   */
  it("is the parent's tenant on the subagent facet", async () => {
    const namespace = (
      env as unknown as { LEADER_SUBAGENT: DurableObjectNamespace }
    ).LEADER_SUBAGENT;
    const stub = namespace.get(namespace.idFromName("gateway-attribution"));
    const name = await runInDurableObject(
      stub,
      (instance) =>
        (
          instance as unknown as {
            subagentRuntime(): { agentName?: string };
          }
        ).subagentRuntime().agentName
    );

    expect(name).toBe(leader.tenant);
  });
});
