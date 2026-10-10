/**
 * Every file a generated project consists of, as data.
 *
 * Pure: a spec builds an `AgentSpec` and reads exactly what would be written,
 * with no filesystem and no process. `../write.ts` is the only thing that turns
 * this into bytes on disk.
 */
import { names } from "./names.js";
import type { AgentSpec } from "./spec.js";
import { agentTs } from "./templates/agent/agent.js";
import { childrenTs } from "./templates/agent/children.js";
import { definitionTs } from "./templates/agent/definition.js";
import { hostTs } from "./templates/agent/host.js";
import { manifestTs } from "./templates/agent/manifest.js";
import { pluginsTs } from "./templates/agent/plugins.js";
import { soulTs } from "./templates/agent/soul.js";
import { tuningTs } from "./templates/agent/tuning.js";
import { workflowTs } from "./templates/agent/workflow.js";
import { agentsMd } from "./templates/project/agents-md.js";
import {
  eslintConfigJs,
  gitignore,
  nvmrc,
  prettierignore,
  prettierrc,
  testTsconfigJson,
  tsconfigJson
} from "./templates/project/dotfiles.js";
import { envExample } from "./templates/project/env-example.js";
import { hostManifestTs } from "./templates/project/host-manifest.js";
import { packageJson } from "./templates/project/package-json.js";
import { readmeMd } from "./templates/project/readme.js";
import { copyTs, modelTs } from "./templates/project/shared.js";
import { vitestConfigTs } from "./templates/project/vitest-config.js";
import { indexTs } from "./templates/project/worker-index.js";
import { wranglerJsonc } from "./templates/project/wrangler.js";
import { edgeSpec } from "./templates/test/edge-spec.js";
import { testWorkerTs } from "./templates/test/test-worker.js";
import { turnSpec } from "./templates/test/turn-spec.js";
import {
  manifestSpec,
  pluginsSpec,
  soulSpec,
  tuningSpec
} from "./templates/test/unit-specs.js";

/** One file to write, its path relative to the project root. */
export interface GeneratedFile {
  path: string;
  contents: string;
}

/**
 * The whole project, in the order a reader would meet it.
 *
 * The agent's own directory is nested under `src/agents/<tenant>/` even though
 * there is one agent: a flatter layout would read better today and would turn a
 * later merge into another Worker into a rename of every file. `./merge-notes.ts`
 * carries the rest of that reasoning.
 */
export function projectFiles(spec: AgentSpec): GeneratedFile[] {
  const n = names(spec.tenant);
  const file = (path: string, contents: string): GeneratedFile => ({
    path,
    contents
  });

  return [
    file("package.json", packageJson(spec)),
    file("wrangler.jsonc", wranglerJsonc(spec, n)),
    file("tsconfig.json", tsconfigJson),
    file("vitest.config.ts", vitestConfigTs(spec, n)),
    file("eslint.config.js", eslintConfigJs),
    file(".prettierrc", prettierrc),
    file(".prettierignore", prettierignore),
    file(".gitignore", gitignore),
    file(".nvmrc", nvmrc),
    file(".env.example", envExample(spec)),
    file("README.md", readmeMd(spec, n)),
    file("AGENTS.md", agentsMd(spec, n)),

    file("src/index.ts", indexTs(spec, n)),
    file("src/host-manifest.ts", hostManifestTs(spec)),
    file("src/copy.ts", copyTs),
    file("src/model.ts", modelTs),

    file(`${n.dir}/definition.ts`, definitionTs(spec, n)),
    file(`${n.dir}/host.ts`, hostTs(n)),
    file(`${n.dir}/workflow.ts`, workflowTs(n)),
    file(`${n.dir}/agent.ts`, agentTs(spec, n)),
    ...(spec.subAgent ? [file(`${n.dir}/children.ts`, childrenTs(n))] : []),
    file(`${n.dir}/manifest.ts`, manifestTs(spec)),
    file(`${n.dir}/plugins.ts`, pluginsTs(spec)),
    file(`${n.dir}/soul.ts`, soulTs(spec)),
    file(`${n.dir}/tuning.ts`, tuningTs(spec)),

    file("test/tsconfig.json", testTsconfigJson),
    file("test/worker.ts", testWorkerTs(spec, n)),
    file("test/turn.spec.ts", turnSpec(spec)),
    file("test/edge.spec.ts", edgeSpec(spec)),
    file("test/soul.spec.ts", soulSpec(spec)),
    file("test/manifest.spec.ts", manifestSpec(spec)),
    file("test/tuning.spec.ts", tuningSpec(spec)),
    file("test/plugins.spec.ts", pluginsSpec(spec))
  ];
}
