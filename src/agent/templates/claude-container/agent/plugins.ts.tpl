import { restrictTools, type AgentPlugin } from "@dynamicagents/core";
import {
  computer,
  type SandboxComputerConfig
} from "@dynamicagents/plugins/computer";
// $when browser
import { browser } from "@dynamicagents/plugins/browser";
// $end
import {
  parentWorkspaceContext,
  SANDBOX_TOOLS,
  sandboxShell
} from "@/workspace/container";
import { gitIdentity } from "@/workspace/git-identity";
import { hostScratch } from "@/workspace/scratch";

/**
 * The one file you edit to add or remove a capability for this agent.
 *
 * The parent delegates the work, so its own list is what it needs to set the
 * work up and check it: a scratchpad to open, a read-only view of it and, where
 * one is installed, a browser for what it has to look up itself. The sessions
 * bring their own tools, inside the container, and this list does not reach
 * them.
 */

/** The parent's sandbox: the caller's scratchpad's, named by the agent. */
export function place(
  env: Env,
  sandboxName: () => string
): SandboxComputerConfig {
  return { binding: env.CLAUDE_CONTAINER_SANDBOX, sandboxName };
}

export const parentPlugins = (
  env: Env,
  at: SandboxComputerConfig
): AgentPlugin<Env>[] => {
  const binding = env.CLAUDE_CONTAINER_SANDBOX;
  const shell = sandboxShell(binding, at.sandboxName);
  return [
    hostScratch({
      exec: shell,
      workspace: () => binding.getByName(at.sandboxName()),
      author: gitIdentity(env)
    }),
    // $when browser
    browser({ binding: env.BROWSER, loader: env.LOADER }),
    // $end
    // Reads only: a parent that could write would race the session it
    // delegated to. `./agent.ts`'s `beforeTurn` drops Think's own writers.
    restrictTools(computer(SANDBOX_TOOLS), {
      allow: ["grep"],
      context: [
        {
          provider: {
            get: async () => parentWorkspaceContext("the Claude Code sessions")
          }
        }
      ]
    })
  ];
};
