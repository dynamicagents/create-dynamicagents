import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { plugins } from "@/agents/$TENANT/plugins";

/**
 * The capabilities this agent installs, against the bindings this project
 * actually declares.
 *
 * A plugin declares what it needs and core checks it when the agent starts, so
 * a capability added without its `wrangler.jsonc` binding is an agent that
 * throws on its first request. This spec is that check, run in a second rather
 * than in production: it reads the `env` the pool builds from
 * `wrangler.jsonc`, so it fails the moment the two disagree.
 */

describe("plugins", () => {
  it("installs each capability once", () => {
    const names = plugins(env).map((plugin) => plugin.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has every binding and secret its plugins require", () => {
    const missing: string[] = [];
    for (const plugin of plugins(env)) {
      const required = [
        ...(plugin.requires?.bindings ?? []),
        ...(plugin.requires?.secrets ?? [])
      ];
      for (const key of required) {
        if ((env as unknown as Record<string, unknown>)[key] == null) {
          missing.push(`${plugin.name} needs ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
