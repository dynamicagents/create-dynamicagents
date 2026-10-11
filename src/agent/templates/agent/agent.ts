import type { AgentNames, AgentSpec } from "../../spec.js";

/** `<dir>/agent.ts` — core's `StepAgent`: what this agent actually is. */
export function agentTs(spec: AgentSpec, n: AgentNames): string {
  const subAgentImports = spec.subAgent
    ? `import type { SubAgentClass } from "@dynamicagents/core/subagent";\n`
    : "";
  const childImport = spec.subAgent
    ? `import { ${n.childClass} } from "./children";\n`
    : "";
  const subAgents = spec.subAgent
    ? `
  override getSubAgents(): SubAgentClass[] {
    return [${n.childClass}];
  }
`
    : "";

  return `import type { ThinkModel } from "@cloudflare/think";
import type { AgentPlugin } from "@dynamicagents/core";
import { StepAgent } from "@dynamicagents/core/agent";
${subAgentImports}import type { StepJob } from "@dynamicagents/core/workflow";
import type { ContextConfig } from "agents/context";
import type { LanguageModel } from "ai";
import { RETRY_BRIEF } from "@/copy";
import { agentModel } from "@/model";
${childImport}import { ${n.camel} } from "./definition";
import { plugins } from "./plugins";
import { MEMORY, SOUL } from "./soul";
import { TUNING } from "./tuning";

/**
 * ${spec.name}.
 *
 * The turn is \`@cloudflare/think\`'s, the step job and delegation are
 * \`@dynamicagents/core/agent\`'s, and the A2A task around it is \`./host.ts\`'s.
 * What is actually *this agent* is the members below plus \`./plugins.ts\`,
 * \`./soul.ts\`${spec.subAgent ? ", `./children.ts`" : ""} and \`./tuning.ts\` — nothing else in this
 * project is specific to it.
 */
export class ${n.agentClass} extends StepAgent<Env> {
  protected readonly compactAfterTokens = TUNING.compactAfterTokens;
  protected readonly keepRecentTokens = TUNING.keepRecentTokens;

  override getModel(): ThinkModel {
    return agentModel(
      this.env,
      { modelId: TUNING.modelId, name: this.name },
      {
        agent: ${n.camel}.tenant,
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
        agent: ${n.camel}.tenant,
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
${subAgents}
  /** A retry is told so, and to carry on from what the first attempt left. */
  protected override formatStepJobInput(job: StepJob): string {
    return job.attempt > 1 ? \`\${RETRY_BRIEF}\\n\\n\${job.input}\` : job.input;
  }
}
`;
}
