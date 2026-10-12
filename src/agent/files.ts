/**
 * Every file a generated project consists of, as data.
 *
 * Pure: a spec builds an `AgentSpec` and reads exactly what would be written,
 * with no filesystem and no process. `../cli/write.ts` is the only thing that
 * turns this into bytes on disk.
 *
 * The generator's three parts, from here: `./spec.ts` and `./names.ts` are the
 * vocabulary every layer reads; `./offer/` is the two menus the CLI puts in
 * front of somebody, which nothing below reads; and `./templates/` is what a
 * template reads, with `templates/agent|project|test/` the one pure function
 * per generated file. Every spec in this directory is a spec on what
 * `projectFiles` returns, which is why they sit beside it.
 */
import { names } from "./names";
import type { AgentSpec } from "./spec";
import { agentTs } from "./templates/agent/agent";
import { childrenTs } from "./templates/agent/children";
import { definitionTs } from "./templates/agent/definition";
import { hostTs } from "./templates/agent/host";
import { manifestTs } from "./templates/agent/manifest";
import { pluginsTs } from "./templates/agent/plugins";
import { soulTs } from "./templates/agent/soul";
import { tuningTs } from "./templates/agent/tuning";
import { workflowTs } from "./templates/agent/workflow";
import { agentsMd } from "./templates/project/agents-md";
import {
  eslintConfigJs,
  gitignore,
  nvmrc,
  prettierignore,
  prettierrc,
  testTsconfigJson,
  tsconfigJson
} from "./templates/project/dotfiles";
import { envExample } from "./templates/project/env-example";
import { hostManifestTs } from "./templates/project/host-manifest";
import { packageJson } from "./templates/project/package-json";
import { readmeMd } from "./templates/project/readme";
import { copyTs, modelTs } from "./templates/project/shared";
import { vitestConfigTs } from "./templates/project/vitest-config";
import { indexTs } from "./templates/project/worker-index";
import { wranglerJsonc } from "./templates/project/wrangler";
import { edgeSpec } from "./templates/test/edge-spec";
import { testWorkerTs } from "./templates/test/test-worker";
import { turnSpec } from "./templates/test/turn-spec";
import {
  manifestSpec,
  pluginsSpec,
  soulSpec,
  tuningSpec
} from "./templates/test/unit-specs";

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
 * later merge into another Worker into a rename of every file. `./templates/merge-notes.ts`
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
