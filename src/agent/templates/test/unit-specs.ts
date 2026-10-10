import type { AgentSpec } from "../../spec.js";
import { MODEL_ID_RE } from "../../names.js";
import { namedFrom } from "../text.js";

/**
 * The specs over the agent's own data: its soul, its card, its numbers and its
 * capabilities. No Worker, no model, no network — each one guards a rule the
 * next person editing that file would otherwise have to remember.
 */

/** `test/soul.spec.ts` */
export const soulSpec = (
  spec: AgentSpec
): string => `import { describe, expect, it } from "vitest";
import { ASK_GUIDANCE } from "@/copy";
${namedFrom(
  "import",
  ["MEMORY", "SOUL", ...(spec.subAgent ? ["GENERAL_SOUL"] : [])],
  `@/agents/${spec.tenant}/soul`
)}

/**
 * The rules the soul has to keep, as it is rewritten.
 *
 * It **will** be rewritten — it is the one file core refuses to ship and the
 * first one to edit. These are the two things easy to break while doing it.
 */

describe("SOUL", () => {
  it("says who the agent is and when to ask the person", () => {
    expect(SOUL).toContain(${JSON.stringify(spec.name)});
    // \`ask_user\` stops the task and puts a question to a person. The guidance
    // for when that is worth doing is shared copy, not this agent's words.
    expect(SOUL).toContain(ASK_GUIDANCE);
  });

  it("describes no capability", () => {
    // Every plugin tells the model what it can do in a context block of its
    // own${spec.subAgent ? ", and each sub-agent in its tool's description" : ""} — so removing one removes its advice with it. A
    // capability named here would outlive the capability.
    for (const claim of ["you can browse", "you have access to"]) {
      expect(SOUL.toLowerCase()).not.toContain(claim);
    }
  });

  it("tells the model what memory is for", () => {
    expect(MEMORY).not.toBe("");
  });
});
${
  spec.subAgent
    ? `
describe("GENERAL_SOUL", () => {
  it("writes to a sub-agent that cannot see this conversation", () => {
    // The distinction is structural rather than stylistic: a sub-agent is
    // handed one self-contained task and nothing else, so a soul written as
    // though it could see the conversation is how it ends up asking a follow-up
    // question nobody will ever read.
    expect(GENERAL_SOUL).toContain("self-contained");
    expect(GENERAL_SOUL).toMatch(/do not ask follow-up questions/i);
  });
});
`
    : ""
}`;

/** `test/manifest.spec.ts` */
export const manifestSpec = (
  spec: AgentSpec
): string => `import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
${namedFrom("import", ["manifest"], `@/agents/${spec.tenant}/manifest`)}
import { hostManifest } from "@/host-manifest";
${namedFrom("import", ["plugins"], `@/agents/${spec.tenant}/plugins`)}

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
    // \`extensions\` is a required (repeated) protobuf field in v1.0: empty is a
    // declaration, absent is a protocol error. \`capabilities\` itself is
    // optional in the SDK's type, which is why it is read through \`?.\` here.
    expect(manifest.capabilities?.extensions).toEqual([]);
    expect(manifest.capabilities?.pushNotifications).toBe(true);
  });

  it("advertises a browse skill only when the browser plugin is installed", () => {
    // The assertion that keeps the card honest: a skill nobody can call is
    // worse than a short card. \`plugins()\` is read rather than a literal, so
    // adding or removing a capability fails here until the card follows.
    const installed = plugins(env).map((plugin) => plugin.name);
    const browses = manifest.skills.some((skill) => skill.id === "browse");
    expect(browses).toBe(installed.includes("browser"));
  });
});

/** The tenant this Worker mounts, as its stub card has to name it. */
const TENANT = "${spec.tenant}";

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
`;

/** `test/tuning.spec.ts` */
export const tuningSpec = (
  spec: AgentSpec
): string => `import { describe, expect, it } from "vitest";
${namedFrom("import", ["TUNING"], `@/agents/${spec.tenant}/tuning`)}

/**
 * The numbers. Core ships none, so these are the project's — and two of them
 * are wrong in ways nothing else notices until a long conversation.
 */

describe("TUNING", () => {
  it("keeps less than it compacts", () => {
    // The tail kept verbatim has to fit inside the budget that triggers
    // compaction, or compaction can never make the history smaller.
    expect(TUNING.keepRecentTokens).toBeLessThan(TUNING.compactAfterTokens);
  });

  it("names models the catalogue has", () => {
    const modelId = ${MODEL_ID_RE.toString()};
    expect(TUNING.modelId).toMatch(modelId);
    expect(TUNING.compactionModelId).toMatch(modelId);
  });
});
`;

/** `test/plugins.spec.ts` */
export const pluginsSpec = (
  spec: AgentSpec
): string => `import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
${namedFrom("import", ["plugins"], `@/agents/${spec.tenant}/plugins`)}

/**
 * The capabilities this agent installs, against the bindings this project
 * actually declares.
 *
 * A plugin declares what it needs and core checks it when the agent starts, so
 * a capability added without its \`wrangler.jsonc\` binding is an agent that
 * throws on its first request. This spec is that check, run in a second rather
 * than in production: it reads the \`env\` the pool builds from
 * \`wrangler.jsonc\`, so it fails the moment the two disagree.
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
          missing.push(\`\${plugin.name} needs \${key}\`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
`;
