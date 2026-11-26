import {
  CONTAINER,
  NODE_ENGINE,
  RUNTIME,
  TOOLCHAIN,
  TRAIN
} from "../../../train";
import type { AgentSpec } from "../../spec";
import { jsonFile } from "../shared/text";

/** npm keeps a manifest's dependency maps sorted, so these are too. */
const sorted = (map: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  );

/**
 * `package.json` for the `claude-container` blueprint.
 *
 * The generic blueprint's manifest plus what a container adds: plugins and zod
 * always, the sandbox package at the exact version its `Dockerfile` names, and
 * esbuild for the daemon the image runs. `check` ends on the script that holds
 * the image's pins to what is installed, because a drift between them builds
 * and deploys cleanly and fails only in a running container.
 */
export const claudeContainerPackageJson = (spec: AgentSpec): string =>
  jsonFile({
    name: spec.tenant,
    version: "0.1.0",
    private: true,
    description: spec.description,
    type: "module",
    scripts: {
      dev: "wrangler dev",
      deploy: "wrangler deploy",
      types: "wrangler types",
      keygen: "da-keys",
      format: "prettier --write .",
      lint: "eslint .",
      check:
        "wrangler types --check && prettier --check . && eslint . && tsc && tsc -p test/tsconfig.json && node scripts/verify-container-env.mjs",
      test: "vitest run",
      "test:watch": "vitest",
      "verify:container-env": "node scripts/verify-container-env.mjs"
    },
    dependencies: sorted({
      "@dynamicagents/core": TRAIN.core,
      "@dynamicagents/plugins": TRAIN.plugins,
      ...RUNTIME,
      "@cloudflare/sandbox": CONTAINER["@cloudflare/sandbox"]
    }),
    devDependencies: sorted({ ...TOOLCHAIN, esbuild: CONTAINER.esbuild }),
    engines: { node: NODE_ENGINE }
  });
