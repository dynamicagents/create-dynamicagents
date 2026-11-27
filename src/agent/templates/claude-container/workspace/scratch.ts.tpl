import { scratch, DEFAULT_SCRATCH_DIR } from "@dynamicagents/plugins/scratch";
import type { AgentPlugin } from "@dynamicagents/core";
import type { sandboxExec } from "@dynamicagents/plugins/sandbox";

/**
 * How *this* Worker addresses the scratchpad every session works in.
 *
 * `@dynamicagents/plugins/scratch` owns what a scratchpad is: a git repository
 * with no remote, its empty initial commit, the reset, the words the model
 * reads. What is here is the half the plugin cannot have: which sandbox it
 * lives in, and recording it there so the sandbox backs it up.
 */

/**
 * What the scratchpad is keyed on: `sandboxName(caller, SCRATCH_REPO)` is the
 * one sandbox a caller has.
 */
export const SCRATCH_REPO = "<scratch>";

/** Where the scratchpad is, inside its sandbox's container. */
export const SCRATCH_DIR = DEFAULT_SCRATCH_DIR;

/** The scratch plugin, wired to record the scratchpad with its sandbox. */
export function hostScratch(config: {
  exec: ReturnType<typeof sandboxExec>;
  workspace: () => {
    noteCheckout(record: {
      dir: string;
      kind: "scratch";
    }): Promise<{ present: boolean }>;
  };
  author: { name: string; email: string };
}): AgentPlugin {
  return scratch({
    exec: config.exec,
    author: config.author,
    afterOpen: async ({ dir }) => {
      const { present } = await config.workspace().noteCheckout({
        dir,
        kind: "scratch"
      });
      return {
        ready: present,
        because: "the sandbox cannot see it yet"
      };
    }
  });
}
