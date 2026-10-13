import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { manifest } from "@/agents/$TENANT/manifest";
import { hostManifest } from "@/host-manifest";
import { plugins } from "@/agents/$TENANT/plugins";

/**
 * The card a gatekeeper registers from.
 *
 * What it says is what callers believe this agent can do, so the assertions
 * here are about it staying true to the agent rather than about its prose.
 */

describe("the agent card", () => {
  it("names the agent and describes it", () => {
    expect(manifest.name).not.toBe("");
    expect(manifest.description).not.toBe("");
  });

  it("gives every skill a unique id, a name and a description", () => {
    const ids = manifest.skills.map((skill) => skill.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const skill of manifest.skills) {
      expect(skill.id).not.toBe("");
      expect(skill.name).not.toBe("");
      expect(skill.description).not.toBe("");
    }
  });

  it("declares the protocol fields core cannot default", () => {
    // `extensions` is a required (repeated) protobuf field in v1.0: empty is a
    // declaration, absent is a protocol error. `capabilities` itself is
    // optional in the SDK's type, which is why it is read through `?.` here.
    expect(manifest.capabilities?.extensions).toEqual([]);
    expect(manifest.capabilities?.pushNotifications).toBe(true);
  });

  it("advertises a browse skill only when the browser plugin is installed", () => {
    // The assertion that keeps the card honest: a skill nobody can call is
    // worse than a short card. `plugins()` is read rather than a literal, so
    // adding or removing a capability fails here until the card follows.
    const installed = plugins(env).map((plugin) => plugin.name);
    const browses = manifest.skills.some((skill) => skill.id === "browse");
    expect(browses).toBe(installed.includes("browser"));
  });
});

/** The tenant this Worker mounts, as its stub card has to name it. */
const TENANT = "$TENANT";

describe("the deployment's stub card", () => {
  it("names every tenant this Worker mounts", () => {
    // It is the only place this card says what is here, so a tenant missing
    // from it is a tenant an operator reading the deploy cannot discover.
    expect(hostManifest.description).toContain(TENANT);
    // The skills belong to the tenants: a client picking one from here would
    // have no way to act on it.
    expect(hostManifest.skills).toEqual([]);
  });
});
