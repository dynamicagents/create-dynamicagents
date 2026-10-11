import type { AgentNames, AgentSpec } from "../../spec.js";

/** `vitest.config.ts` — one pool, in the real Workers runtime. */
export function vitestConfigTs(spec: AgentSpec, n: AgentNames): string {
  const T = `Test${n.pascal}`;

  const durableObject = (binding: string, className: string): string =>
    `          ${binding}: {\n            className: "${className}",\n            useSQLite: true\n          }`;

  const durableObjects = [
    durableObject(`TEST_${n.screaming}_HOST`, `${T}Host`),
    durableObject(`TEST_${n.screaming}_AGENT`, `${T}Agent`),
    ...(spec.subAgent
      ? [durableObject(`TEST_${n.screaming}_CHILD`, `${T}Child`)]
      : [])
  ].join(",\n");

  const facetNote = spec.subAgent
    ? `
        //
        // In production a sub-agent needs **no** binding and no
        // \`new_sqlite_classes\` entry — its storage is a facet created beneath
        // the bound parent agent — but the pool only treats *bound* classes as
        // Durable Object classes, so without one here the parent cannot create
        // it.`
    : "";

  return `import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import path from "node:path";
// The realm-neutral slice, deliberately. This file runs in **Node**, and the
// \`/testing\` barrel pulls in \`cloudflare:test\`, which fails at load before a
// single test runs.
import {
  GATEKEEPER_ORIGIN,
  TEST_AGENT_PRIVATE_JWK
} from "@dynamicagents/core/testing/fixtures";

/**
 * The whole suite runs in the Workers runtime (workerd via miniflare) through
 * one \`cloudflareTest()\` pool.
 *
 * The pool reads \`wrangler.jsonc\` directly — the compatibility settings, the AI
 * binding, the Durable Objects and their SQLite migration — so this config
 * cannot drift from it. Its \`main\` is \`test/worker.ts\`, which is this Worker
 * plus the agent on a scripted model: Workers AI has no local execution mode,
 * so a real model cannot finish a turn here.
 */

// Test defaults for the secrets \`wrangler.jsonc\` requires. Real env vars — from
// CI or the shell — take precedence through \`??=\`. The pool sources
// \`secrets.required\` from \`process.env\` into the worker \`env\`.
process.env.A2A_SIGNING_KEY ??= JSON.stringify(TEST_AGENT_PRIVATE_JWK);
process.env.GATEKEEPER_ORIGINS ??= JSON.stringify([GATEKEEPER_ORIGIN]);

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") }
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      main: "./test/worker.ts",
      // Required, not just the default. Workers AI has no local execution mode
      // — miniflare always proxies \`AI\` through a remote-connection worker —
      // and leaving this unset makes the pool open that connection per test
      // file, for a binding no spec here calls. \`false\` avoids it entirely.
      remoteBindings: false,
      miniflare: {
        // Test-only Durable Object bindings: the scripted classes in
        // \`test/worker.ts\`, which \`wrangler.jsonc\` knows nothing about.${facetNote}
        durableObjects: {
${durableObjects}
        },
        // The scripted pipeline, beside the real one \`wrangler.jsonc\` binds.
        workflows: {
          TEST_${n.workflowBinding}: {
            name: "test-${n.workflowName}",
            className: "${T}Workflow"
          }
        }
      }
    })
  ],
  test: {
    include: ["test/**/*.spec.ts"],
    // A task runs in a Workflow and on its agent's alarms, so a lifecycle spec
    // waits on real scheduling rather than on a promise.
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
});
`;
}
