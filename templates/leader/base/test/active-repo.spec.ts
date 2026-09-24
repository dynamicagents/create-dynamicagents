import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import type { PluginHost } from "@dynamicagents/core/host";
import { activeRepo } from "@/workspace/active-repo";

/**
 * The routing row and the recorded checkout, in real SQLite.
 *
 * Any Durable Object's storage will do — `activeRepo` reads nothing from its
 * host but `storage` — so the workspace namespace lends one.
 */
const withActive = (
  name: string,
  fn: (active: ReturnType<typeof activeRepo>) => void
) =>
  runInDurableObject(
    env.LEADER_WORKSPACE.get(env.LEADER_WORKSPACE.idFromName(name)),
    (_instance, state) =>
      fn(activeRepo({ storage: state.storage } as unknown as PluginHost<Env>))
  );

describe("the recorded checkout", () => {
  it("is forgotten when a clone of another repository begins", async () => {
    await withActive("active-repo-clear", (active) => {
      active.set("acme/api");
      active.setCheckout({
        url: "https://github.com/acme/api.git",
        dir: "/workspace/api",
        branch: "main"
      });

      // What `beforeCheckout` does. The clone of `acme/cli` may yet be refused,
      // and until it records its own checkout there must be none — not api's,
      // answering for cli.
      active.set("acme/cli");
      active.clearCheckout();

      expect(active.get()).toBe("acme/cli");
      expect(active.checkout()).toBeUndefined();
    });
  });
});
