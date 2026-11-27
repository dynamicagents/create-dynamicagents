import type {
  ThinkModel,
  ThinkScheduledTasks,
  TurnConfig,
  TurnContext
} from "@cloudflare/think";
import type { AgentPlugin } from "@dynamicagents/core";
import { StepAgent } from "@dynamicagents/core/agent";
import type { SubAgentClass } from "@dynamicagents/core/subagent";
import type { StepJob } from "@dynamicagents/core/workflow";
import type { ContextConfig } from "agents/context";
import type { LanguageModel, ToolSet } from "ai";
import { CLAUDE_CONTAINER, SANDBOX_RECLAIM_MS } from "@/config";
import { RETRY_BRIEF } from "@/copy";
import { agentModel, transientChatError } from "@/model";
import { sandboxShell, THINK_FILE_TOOLS } from "@/workspace/container";
import { ClaudeContainerSessionChild, scratchSandbox } from "./children";
import { claudeContainer } from "./definition";
import { parentPlugins } from "./plugins";
import { shareFileTool } from "./share";
import { MEMORY, SOUL } from "./soul";

/** This agent's log prefix. */
const LABEL = "claude-container";

/**
 * The claude-container agent: a parent that hands work to Claude Code sessions
 * in a container, and shares what they make.
 *
 * The parent runs on a model of its own (`src/config.ts`) and has no shell and
 * no file tools: it opens the scratchpad, briefs a session, reads the session's
 * report, and shares the files it names with the person. Every write is a
 * session's, a `claude -p` process in the sandbox's container, on a Claude
 * subscription credential the container never holds: see
 * `@dynamicagents/plugins/claude-code`.
 */
export class ClaudeContainerAgent extends StepAgent<Env> {
  protected readonly compactAfterTokens = CLAUDE_CONTAINER.compactAfterTokens;
  protected readonly keepRecentTokens = CLAUDE_CONTAINER.keepRecentTokens;

  /** The caller's one sandbox, which holds the scratchpad. */
  readonly #sandboxName = (): string => scratchSandbox(this.callerKey());

  override classifyChatError(error: unknown) {
    return transientChatError(error) ?? super.classifyChatError(error);
  }

  override getModel(): ThinkModel {
    return agentModel(
      this.env,
      { modelId: CLAUDE_CONTAINER.modelId, name: this.name },
      {
        agent: claudeContainer.tenant,
        taskId: this.turnTaskId(),
        phase: "turn"
      }
    );
  }

  /** Compaction runs over a history every task shares, so it has no task. */
  protected override compactionModel(): LanguageModel {
    return agentModel(
      this.env,
      { modelId: CLAUDE_CONTAINER.compactionModelId, name: this.name },
      { agent: claudeContainer.tenant, phase: "compaction" }
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
    return parentPlugins(this.env, this.#sandboxName);
  }

  override getSubAgents(): SubAgentClass[] {
    return [ClaudeContainerSessionChild];
  }

  /**
   * `share_file` is here rather than in a plugin because it answers a link, and
   * a link needs this deployment's own origin, which arrives with a turn and is
   * the agent's. Read per call for the same reason.
   */
  override getTools(): ToolSet {
    return {
      ...super.getTools(),
      share_file: shareFileTool({
        exec: sandboxShell(
          this.env.CLAUDE_CONTAINER_SANDBOX,
          this.#sandboxName
        ),
        env: this.env,
        owner: () => this.callerKey(),
        origin: () => this.selfOrigin()
      })
    };
  }

  /**
   * The turn core configures, minus Think's own file tools: they work on this
   * object's SQLite, not the scratchpad, so a model offered them would read an
   * empty tree or write files no session or person ever sees. The model reasons
   * at `CLAUDE_CONTAINER`'s effort where it sets one, which an `openai/*` model
   * alone reads.
   */
  override async beforeTurn(ctx: TurnContext): Promise<TurnConfig | void> {
    const base = await super.beforeTurn(ctx);
    const { reasoningEffort } = CLAUDE_CONTAINER;
    return {
      ...base,
      activeTools:
        base?.activeTools ??
        Object.keys(ctx.tools).filter((name) => !THINK_FILE_TOOLS.has(name)),
      ...(reasoningEffort
        ? {
            providerOptions: {
              ...base?.providerOptions,
              openai: { reasoningEffort }
            }
          }
        : {})
    };
  }

  /** A weekly sweep of the caller's sandbox, once nobody has used it. */
  override getScheduledTasks(): ThinkScheduledTasks {
    return {
      ...super.getScheduledTasks(),
      reclaimIdleSandbox: {
        schedule: "every week on sunday at 03:00 in UTC",
        handler: () => this.#reclaim()
      }
    };
  }

  async #reclaim(): Promise<void> {
    const name = scratchSandbox(this.callerKey());
    try {
      const result =
        await this.env.CLAUDE_CONTAINER_SANDBOX.getByName(name).reclaimIfIdle(
          SANDBOX_RECLAIM_MS
        );
      if (result.reclaimed) {
        console.info(`[${LABEL}] reclaimed an idle sandbox`, { name });
      }
    } catch (err) {
      console.warn(`[${LABEL}] could not sweep a sandbox`, {
        name,
        err: String(err)
      });
    }
  }

  /** A retry is told so, and to carry on from what the first attempt left. */
  protected override formatStepJobInput(job: StepJob): string {
    return job.attempt > 1 ? `${RETRY_BRIEF}\n\n${job.input}` : job.input;
  }
}
