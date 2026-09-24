import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import {
  createAgentRuntime,
  definePlugin,
  resolveConfig
} from "@dynamicagents/core";
import { LEADER_CONFIG } from "@/config";

/**
 * The seam between this repo and the packages it composes: what happens when
 * they disagree, and whether the config it declares survives resolution.
 */

describe("contract skew between the packages", () => {
  it("fails at startup on a missing declared binding, not at the first tool call", () => {
    // A plugin cannot add its own wrangler binding, which is the whole reason it
    // declares `requires`. Failing here beats failing inside a request someone is
    // waiting on.
    const needsSecret = definePlugin({
      key: "needs-secret",
      requires: { secrets: ["NOT_A_REAL_SECRET"] }
    });

    expect(() =>
      createAgentRuntime({
        config: LEADER_CONFIG,
        plugins: [needsSecret],
        env
      })
    ).toThrow(/missing bindings or secrets/);
  });
});

describe("config resolution", () => {
  it("keeps the leader's declared overrides", () => {
    const resolved = resolveConfig(LEADER_CONFIG);
    expect(resolved.model.chatModelId).toBe(LEADER_CONFIG.model!.chatModelId);
    expect(resolved.maxSubtasks).toBe(LEADER_CONFIG.maxSubtasks);
  });
});
