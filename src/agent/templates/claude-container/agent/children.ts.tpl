import type { ThinkModel } from "@cloudflare/think";
import type { SubAgentPrepareContext, SubAgentSpec } from "@dynamicagents/core";
import { SubAgent } from "@dynamicagents/core/subagent";
import {
  CLAUDE_CODE_AGENT,
  CLAUDE_CODE_WRITE_INPUT,
  claudeCodeModel,
  type SandboxRuns,
  type SessionOutcome
} from "@dynamicagents/plugins/claude-code";
import {
  sandboxName,
  sandboxNameFromRuntime,
  SANDBOX_RUNTIME_KEY
} from "@dynamicagents/plugins/sandbox";
import { CLAUDE_CODE_SESSION } from "@/config";
import { transientChatError } from "@/model";
import { SCRATCH_DIR, SCRATCH_REPO } from "@/workspace/scratch";

/**
 * The one sub-agent: a Claude Code session in the caller's scratchpad.
 *
 * `@dynamicagents/plugins/claude-code` brings the session as the sub-agent's
 * model, so what is here is only where it works and what the parent hears back.
 * It works in the scratchpad, never in a checkout: this agent clones nothing and
 * pushes nothing, so a session's work stays in the container until the parent
 * shares a file from it.
 */

/** What a session is told about its directory, before the task. */
const SCRATCH_NOTE = [
  "You are working in a scratchpad: a git repository with no remote, inside a",
  "container. Create, edit and run whatever the task needs here. Nothing you",
  "write leaves the container unless the person is sent it, so when you produce",
  "a file the person should have, end your answer with its path relative to this",
  "directory, one per line, under a heading `Files:`."
].join(" ");

/** Refused before anything is dispatched: nothing to run a session in. */
const NO_SCRATCHPAD =
  "claude_code: there is no scratchpad yet. Call `scratch_open` first, then delegate again.";

const NO_CREDENTIAL =
  "claude_code: no Anthropic credential is configured in this deployment. An operator has to set a `claude setup-token` credential.";

/** The sandbox a caller's scratchpad lives in. One per caller. */
export const scratchSandbox = (callerKey: string): string =>
  sandboxName(callerKey, SCRATCH_REPO);

/**
 * Where the session works. Refuses a run with no scratchpad open, and a
 * deployment with no Claude credential, before anything starts.
 */
async function prepareSession(
  ctx: SubAgentPrepareContext<unknown, Env>
): Promise<Record<string, unknown>> {
  const name = scratchSandbox(ctx.parent.callerKey());
  const sandbox = ctx.parent.env.CLAUDE_CONTAINER_SANDBOX.getByName(name);
  if (!(await sandbox.checkoutDir())) throw new Error(NO_SCRATCHPAD);
  if (!(await sandbox.claudeAdmit()).ok) throw new Error(NO_CREDENTIAL);
  return { [SANDBOX_RUNTIME_KEY]: name, dir: SCRATCH_DIR };
}

/** One line of what a session cost, under its answer. */
function sessionFooter(result: {
  numTurns?: number;
  durationMs?: number;
  costUsd: number;
}): string {
  return [
    `turns: ${result.numTurns ?? "?"}`,
    `duration: ${Math.round((result.durationMs ?? 0) / 1000)}s`,
    `cost: $${result.costUsd.toFixed(4)}`
  ].join(" · ");
}

/** What the parent receives: the session's answer, or why there is none. */
export function sessionReport(outcome: SessionOutcome): string {
  const result = outcome.session.result;
  if (!result) {
    const said = outcome.session.stderr?.trim();
    return (
      `The Claude Code session exited with code ${outcome.session.exitCode} without an answer.` +
      (said ? `\n\nIt printed:\n\n\`\`\`\n${said}\n\`\`\`` : "")
    );
  }
  const footer = sessionFooter(result);
  if (result.isError) {
    return `The Claude Code session failed: ${result.text || result.subtype}\n\n${footer}`;
  }
  return `${result.text || "(The session finished without saying anything.)"}\n\n${footer}`;
}

/** A Claude Code session, on the scratchpad the parent opened. */
export class ClaudeContainerSessionChild extends SubAgent<Env> {
  static override spec = {
    ...CLAUDE_CODE_AGENT,
    description: [
      "Hand a task to a Claude Code session running in your scratchpad's container.",
      "It has its own tools: it reads, writes and runs files, installs what it needs",
      "and iterates, then reports what it did and the paths of any files it made.",
      "It runs in the background: the call returns at once, and its report arrives",
      "in a later turn.",
      "",
      "Give it one coherent task, described the way you would describe it to an",
      "engineer: what should be true when it is done, and how to tell. It cannot ask",
      "anything mid-run, so decide or ask the person first."
    ].join("\n"),
    inputSchema: CLAUDE_CODE_WRITE_INPUT.pick({ task: true }),
    prepare: prepareSession
  } as SubAgentSpec<never, never>;

  override classifyChatError(error: unknown) {
    return transientChatError(error) ?? super.classifyChatError(error);
  }

  override getModel(): ThinkModel {
    const runtime = this.pluginContext().runtime();
    const name = sandboxNameFromRuntime(runtime);
    if (!name) {
      throw new Error(
        "claude-container: this session carries no sandbox; its spec's prepare names one"
      );
    }
    const dir = typeof runtime?.dir === "string" ? runtime.dir : SCRATCH_DIR;
    return claudeCodeModel({
      sandbox: () =>
        this.env.CLAUDE_CONTAINER_SANDBOX.getByName(
          name
        ) as unknown as SandboxRuns,
      storage: this.ctx.storage,
      runId: this.name,
      dir,
      timeoutMs: CLAUDE_CODE_SESSION.timeoutMs,
      note: this.note.bind(this),
      brief: async (task) => `${SCRATCH_NOTE}\n\n${task}`,
      report: async (outcome) => sessionReport(outcome)
    });
  }
}
