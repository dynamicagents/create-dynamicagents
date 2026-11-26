/**
 * The `claude-container` blueprint: every file it writes, by role.
 *
 * A parent that hands a task to a Claude Code session in a sandbox container,
 * in a scratchpad, and shares the files it makes as artifact links. No
 * repository and no GitHub credential.
 */
export interface Template {
  wranglerJsonc: string;
  vitestConfigTs: string;
  gitignore: string;
  dockerignore: string;
  envExample: string;
  readmeMd: string;
  agentsMd: string;
  dockerfile: string;
  buildDaemonMjs: string;
  verifyContainerEnvMjs: string;

  indexTs: string;
  configTs: string;
  copyTs: string;
  modelTs: string;
  sandboxDaemonTs: string;
  /** `src/workspace/`, each file by name. */
  workspace: readonly [string, string][];
  /** The agent's own directory, each file by name, in the order a reader meets it. */
  agent: readonly [string, string][];

  workerTs: string;
  edgeSpecTs: string;
  /** The agent's specs, `{tenant}` standing for its id. */
  tests: readonly [string, string][];
}

import agentsMd from "./project/AGENTS.md.tpl";
import buildDaemonMjs from "./project/build-daemon.mjs.tpl";
import configTs from "./project/config.ts.tpl";
import copyTs from "./project/copy.ts.tpl";
import dockerfile from "./project/Dockerfile.tpl";
import dockerignore from "./project/dockerignore.tpl";
import envExample from "./project/env.example.tpl";
import gitignore from "./project/gitignore.tpl";
import indexTs from "./project/index.ts.tpl";
import modelTs from "./project/model.ts.tpl";
import readmeMd from "./project/README.md.tpl";
import sandboxDaemonTs from "./project/sandbox-daemon.ts.tpl";
import verifyContainerEnvMjs from "./project/verify-container-env.mjs.tpl";
import vitestConfigTs from "./project/vitest.config.ts.tpl";
import wranglerJsonc from "./project/wrangler.jsonc.tpl";

import containerTs from "./workspace/container.ts.tpl";
import gitIdentityTs from "./workspace/git-identity.ts.tpl";
import installPlanTs from "./workspace/install-plan.ts.tpl";
import scratchTs from "./workspace/scratch.ts.tpl";

import agentTs from "./agent/agent.ts.tpl";
import childrenTs from "./agent/children.ts.tpl";
import claudeCodeTs from "./agent/claude-code.ts.tpl";
import definitionTs from "./agent/definition.ts.tpl";
import egressTs from "./agent/egress.ts.tpl";
import hostTs from "./agent/host.ts.tpl";
import manifestTs from "./agent/manifest.ts.tpl";
import pluginsTs from "./agent/plugins.ts.tpl";
import sandboxTs from "./agent/sandbox.ts.tpl";
import shareTs from "./agent/share.ts.tpl";
import soulTs from "./agent/soul.ts.tpl";
import workflowTs from "./agent/workflow.ts.tpl";

import agentSpecTs from "./test/agent.spec.ts.tpl";
import edgeSpecTs from "./test/edge.spec.ts.tpl";
import workerTs from "./test/worker.ts.tpl";

export const TEMPLATE: Template = {
  wranglerJsonc,
  vitestConfigTs,
  gitignore,
  dockerignore,
  envExample,
  readmeMd,
  agentsMd,
  dockerfile,
  buildDaemonMjs,
  verifyContainerEnvMjs,

  indexTs,
  configTs,
  copyTs,
  modelTs,
  sandboxDaemonTs,
  workspace: [
    ["container.ts", containerTs],
    ["git-identity.ts", gitIdentityTs],
    ["install-plan.ts", installPlanTs],
    ["scratch.ts", scratchTs]
  ],
  agent: [
    ["definition.ts", definitionTs],
    ["host.ts", hostTs],
    ["workflow.ts", workflowTs],
    ["agent.ts", agentTs],
    ["children.ts", childrenTs],
    ["manifest.ts", manifestTs],
    ["plugins.ts", pluginsTs],
    ["soul.ts", soulTs],
    ["share.ts", shareTs],
    ["claude-code.ts", claudeCodeTs],
    ["sandbox.ts", sandboxTs],
    ["egress.ts", egressTs]
  ],

  workerTs,
  edgeSpecTs,
  tests: [["{tenant}.spec.ts", agentSpecTs]]
};
