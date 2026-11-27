import type { AgentPlugin } from "@dynamicagents/core";
// $when browser
import { browser } from "@dynamicagents/plugins/browser";
// $end
import { sandboxShell } from "@/workspace/container";
import { gitIdentity } from "@/workspace/git-identity";
import { hostScratch } from "@/workspace/scratch";

/**
 * The one file you edit to add or remove a capability for this agent.
 *
 * The parent delegates the work, so its own list is what it needs to set the
 * work up: a scratchpad to open and, where one is installed, a browser for what
 * it has to look up itself. It has no file tools: what a session made reaches
 * it as the session's report, and reaches the person through `share_file`. The
 * sessions bring their own tools, inside the container, and this list does not
 * reach them.
 *
 * `sandboxName` is the caller's sandbox, the one that holds its scratchpad.
 */
export const parentPlugins = (
  env: Env,
  sandboxName: () => string
): AgentPlugin<Env>[] => {
  const binding = env.CLAUDE_CONTAINER_SANDBOX;
  return [
    // $when browser
    browser({ binding: env.BROWSER, loader: env.LOADER }),
    // $end
    hostScratch({
      exec: sandboxShell(binding, sandboxName),
      workspace: () => binding.getByName(sandboxName()),
      author: gitIdentity()
    })
  ];
};
