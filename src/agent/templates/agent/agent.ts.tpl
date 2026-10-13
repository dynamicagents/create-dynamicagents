import type { ThinkModel } from "@cloudflare/think";
import type { AgentPlugin } from "@dynamicagents/core";
import { StepAgent } from "@dynamicagents/core/agent";
// $when subAgent
import type { SubAgentClass } from "@dynamicagents/core/subagent";
// $end
import type { StepJob } from "@dynamicagents/core/workflow";
import type { ContextConfig } from "agents/context";
import type { LanguageModel } from "ai";
import { RETRY_BRIEF } from "@/copy";
import { agentModel } from "@/model";
// $when subAgent
import { $CHILD_CLASS } from "./children";
// $end
import { $CAMEL } from "./definition";
import { plugins } from "./plugins";
import { MEMORY, SOUL } from "./soul";
import { TUNING } from "./tuning";

/**
 * $NAME.
 *
 * The turn is `@cloudflare/think`'s, the step job and delegation are
 * `@dynamicagents/core/agent`'s, and the A2A task around it is `./host.ts`'s.
 * What is actually *this agent* is the members below plus `./plugins.ts`,
 * `./soul.ts`$SOUL_FILES and `./tuning.ts` — nothing else in this
 * project is specific to it.
 */
export class $AGENT_CLASS extends StepAgent<Env> {
  protected readonly compactAfterTokens = TUNING.compactAfterTokens;
  protected readonly keepRecentTokens = TUNING.keepRecentTokens;

  override getModel(): ThinkModel {
    return agentModel(
      this.env,
      { modelId: TUNING.modelId, name: this.name },
      {
        agent: $CAMEL.tenant,
        taskId: this.turnTaskId(),
        phase: "turn"
      }
    );
  }

  /** Compaction runs over a history every task shares, so it has no task. */
  protected override compactionModel(): LanguageModel {
    return agentModel(
      this.env,
      { modelId: TUNING.compactionModelId, name: this.name },
      {
        agent: $CAMEL.tenant,
        phase: "compaction"
      }
    );
  }

  override configureContext(): ContextConfig[] {
    return [
      { label: "soul", provider: { get: async () => SOUL } },
      { label: "memory", description: MEMORY },
      ...super.configureContext()
    ];
  }

  override getPlugins(): AgentPlugin<Env>[] {
    return plugins(this.env);
  }

  // $when subAgent
  override getSubAgents(): SubAgentClass[] {
    return [$CHILD_CLASS];
  }

  // $end
  /** A retry is told so, and to carry on from what the first attempt left. */
  protected override formatStepJobInput(job: StepJob): string {
    return job.attempt > 1 ? `${RETRY_BRIEF}\n\n${job.input}` : job.input;
  }
}
