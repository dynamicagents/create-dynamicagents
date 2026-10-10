import type { AgentNames } from "../../spec.js";

/** `<dir>/children.ts` — the `general` sub-agent, bound to a class. */
export const childrenTs = (
  n: AgentNames
): string => `import type { ThinkModel } from "@cloudflare/think";
import type { AgentPlugin, SubAgentSpec } from "@dynamicagents/core";
import { SubAgent } from "@dynamicagents/core/subagent";
import { z } from "zod";
import { agentModel, turnTask } from "@/model";
import { ${n.camel} } from "./definition";
import { plugins } from "./plugins";
import { GENERAL_SOUL } from "./soul";
import { TUNING } from "./tuning";

/**
 * The catch-all: any self-contained unit of work with no domain of its own.
 *
 * **Awaited.** Research, drafting and reading a page finish well inside the
 * fifteen minutes a turn can last, so the parent waits for the result in the
 * same turn rather than answering in a later one. A sub-agent that may run
 * longer than a turn declares \`detached: true\` instead — there is nothing in
 * between.
 *
 * A spec is data; the class below binds it. Core refuses to lend a soul, so a
 * sub-agent's identity is written here and nowhere else.
 */
const GENERAL: SubAgentSpec<{ task: string }> = {
  name: "general",
  description:
    "Hand a self-contained piece of work to a sub-agent and wait for its result: research, drafting, summarizing. It cannot see this conversation, so put everything it needs in the task.",
  inputSchema: z.object({
    task: z
      .string()
      .describe(
        "The work, with everything needed to do it: the sub-agent sees nothing else"
      )
  }),
  soul: GENERAL_SOUL,
  formatInput: (input) => input.task
};

export class ${n.childClass} extends SubAgent<Env> {
  static override spec = GENERAL as SubAgentSpec<never, never>;

  override getModel(): ThinkModel {
    return agentModel(
      this.env,
      { modelId: TUNING.modelId, name: this.name },
      {
        agent: ${n.camel}.tenant,
        taskId: turnTask(this.activeTurnMetadata),
        phase: "subagent",
        subAgent: "${n.childClass}"
      }
    );
  }

  override getPlugins(): AgentPlugin<Env>[] {
    return plugins(this.env);
  }
}
`;
