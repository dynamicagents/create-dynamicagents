import { NODE_ENGINE } from "../../../train.js";
import { dependenciesFor, devDependenciesFor } from "../../dependencies.js";
import type { AgentSpec } from "../../spec.js";
import { jsonFile } from "../text.js";

/**
 * `package.json`.
 *
 * Written by this CLI rather than left to `npm install` to fill in, so the
 * manifest is ours: formatted like everything else it generates, and covered by
 * the formatting spec. The ranges are `src/train.ts`'s, narrowed by
 * `../../dependencies.ts` to what this agent actually imports.
 *
 * `check` is ordered the way it is because each step depends on the last:
 * `wrangler types --check` fails on a stale `worker-configuration.d.ts`, which
 * every `tsc` below it then reads.
 */
export const packageJson = (spec: AgentSpec): string =>
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
        "wrangler types --check && prettier --check . && eslint . && tsc && tsc -p test/tsconfig.json",
      test: "vitest run",
      "test:watch": "vitest"
    },
    dependencies: dependenciesFor(spec),
    devDependencies: devDependenciesFor(),
    engines: { node: NODE_ENGINE }
  });
