/**
 * The generic blueprint: a delegating assistant composed from the answers, a
 * sub-agent or not and its capabilities. Each file it writes is a pair under
 * `./agent|project|test/`, the `.tpl` holding the text and the module binding
 * its variation.
 */
import { names } from "../../names";
import type { AgentSpec } from "../../spec";
import { hasGeneral } from "../../spec";
import { agentTs } from "./agent/agent";
import { childrenTs } from "./agent/children";
import { definitionTs } from "./agent/definition";
import { hostTs } from "./agent/host";
import { manifestTs } from "./agent/manifest";
import { pluginsTs } from "./agent/plugins";
import { soulTs } from "./agent/soul";
import { tuningTs } from "./agent/tuning";
import { workflowTs } from "./agent/workflow";
import { agentsMd } from "./project/agents-md";
import {
  eslintConfigJs,
  gitignore,
  nvmrc,
  prettierignore,
  prettierrc,
  testTsconfigJson,
  tsconfigJson
} from "../shared/dotfiles";
import { envExample } from "./project/env-example";
import { hostManifestTs } from "../shared/host-manifest";
import { packageJson } from "./project/package-json";
import { readmeMd } from "./project/readme";
import { copyTs, modelTs } from "./project/shared";
import { vitestConfigTs } from "./project/vitest-config";
import { indexTs } from "./project/worker-index";
import { wranglerJsonc } from "./project/wrangler";
import { edgeSpec } from "./test/edge-spec";
import { testWorkerTs } from "./test/test-worker";
import { turnSpec } from "./test/turn-spec";
import {
  manifestSpec,
  pluginsSpec,
  soulSpec,
  tuningSpec
} from "./test/unit-specs";

import type { GeneratedFile } from "../../files";

/**
 * The generic blueprint, composed from the answers: the whole project, in the
 * order a reader would meet it.
 *
 * The agent's own directory is nested under `src/agents/<tenant>/` even though
 * there is one agent: a flatter layout would read better today and would turn a
 * later merge into another Worker into a rename of every file. `../shared/merge-notes.ts`
 * carries the rest of that reasoning.
 */
export function genericFiles(spec: AgentSpec): GeneratedFile[] {
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
    ...(hasGeneral(spec) ? [file(`${n.dir}/children.ts`, childrenTs(n))] : []),
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
