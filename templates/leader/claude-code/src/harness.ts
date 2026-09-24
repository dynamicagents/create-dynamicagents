import type { ClaudeCodeConfig } from "@dynamicagents/plugins/claude-code";
import type { RecallTuning } from "@dynamicagents/plugins/recall";

// The tuning types are imported type-only, so nothing reaches a bundle. They are
// what make a mistyped or renamed tuning field fail at `tsc`: a key a plugin type
// does not declare is an error written inline and no error at all through a
// spread, so each constant below is checked with `as const satisfies`, which
// checks the shape while keeping the literal types.

/**
 * The parent round under the Claude Code harness: the leader's shape, with the
 * *work* done elsewhere.
 *
 * The parent round loop is Workers AI. What is different is that its subtasks
 * do not run core's tool loop at all: each one is a Claude Code session inside
 * the workspace container, driven by
 * `@dynamicagents/plugins/claude-code`. See {@link CLAUDE_CODE_SESSION} for the
 * numbers that bound *that*, which are not these.
 *
 * **The fan-out is bounded by containers, not by this file.** A writing subtask
 * works in a worktree of its own — two Claude Code sessions in one container are two
 * autonomous agents editing one working tree, each running the project's test
 * suite over the other's half-finished edits. So what a round of N writers costs
 * is N+1 container instances, counting the parent's own workspace.
 *
 * **That is not the same as fitting inside `max_instances`, and it is worth being
 * exact about.** This number is per *task*; the wrangler ceiling is per container
 * entry across the whole deployment, sized as this peak times the tasks expected
 * to run at once. Past that concurrency the extra workspaces queue or fail to
 * start, and nothing here rations it: a task that cannot get a container is the
 * signal, and `npm run cf -- containers` is what shows it.
 *
 * `maxSubtasks` in `src/config.ts` is that per-task number; it is not restated
 * here so that a value this consequential is written down once.
 *
 * **The model pair is inverted against `MODEL` in `src/config.ts`.** The parent
 * round does no work of its own — it reads diffs, decides what to delegate and
 * ends the round with a control tool — so every turn it spends is a decision
 * about a container boot and a Claude Code session, and a round that delegates
 * the wrong subtask is paid for at that price rather than a retry's. The flash
 * model is the second attempt.
 *
 * `reasoningEffort` stays at `MODEL`'s `high`, which is core's ceiling —
 * `ModelConfig.reasoningEffort` has no level above it.
 */
export const PARENT_MODEL = {
  chatModelId: "@cf/zai-org/glm-5.3",
  fallbackChatModelId: "@cf/zai-org/glm-5.3-flash"
} as const;

/**
 * What bounds one Claude Code session — and **this is the whole list**.
 *
 * The obvious place to look is wrong: core's `subagentLimits.maxWallMs` and the
 * recipe's own `limits` are metered by the resumable runner, and this agent's
 * `executeChunk` bypasses it entirely to drive the CLI instead. A limit written
 * there is inert.
 *
 * Nor is there a spend cap, deliberately — an estimate in dollars is a guess
 * about a subscription bucket nobody can read, and the egress gateway reads the
 * bucket directly, rotating credentials when Anthropic says one is spent. That
 * bounds the deployment, not a session.
 *
 * So `timeoutMs` is the ceiling, and the container runtime enforces it.
 */
export const CLAUDE_CODE_SESSION = {
  /**
   * Opus 5, deliberately: reaching it on a subscription credential is the whole
   * reason this agent exists, so spending the bucket on something cheaper would
   * be paying the setup cost and declining the return.
   *
   * A 5-hour bucket is roughly $10 of Opus-equivalent and a substantial coding
   * subtask is plausibly $1-5, so expect two to four per bucket per credential.
   * `claude-sonnet-5` stretches that several times further if a deployment would
   * rather have volume.
   */
  model: "claude-opus-5",

  /**
   * `xhigh`, the level above Opus 5's own default of `high`. Same argument as
   * the model: the bucket is spent either way once a session starts, and what
   * costs a deployment real time is not an expensive subtask but a cheap one
   * that half-finishes and leaves a checkout somebody has to read before the
   * next round can use it.
   *
   * It is bought per turn, so it compounds over a session, at a multiple
   * `@dynamicagents/plugins/claude-code` documents — against the estimate above,
   * expect nearer two substantial subtasks per bucket than four. Drop to `high`
   * for volume, the way `claude-sonnet-5` is for the model.
   *
   * Spelled as a level the CLI knows, because one it does not know is **warned
   * about on stderr and ignored** — the session then runs at the default and
   * nothing downstream says so. `EffortLevel` in
   * `@dynamicagents/plugins/claude-code` is the type that catches that.
   */
  effort: "xhigh",

  /**
   * Forty minutes, and **this is the ceiling on a session** — see above.
   *
   * Longer than the workspace base's twenty-minute default container-idle
   * window, so `LeaderWorkspaceDO` derives its own from this constant
   * rather than restating it. A session stays detached for its whole timeout, so
   * an idle window narrower than this makes the container's survival depend on
   * chunk boundaries arriving on time, and one retried or delayed chunk stops it
   * under live work.
   */
  timeoutMs: 40 * 60_000,

  /**
   * Caps on Claude Code's own subagent tree, and advisory rather than enforced:
   * that tree is invisible to Dynamic Agents' scheduler and multiplies whatever
   * they say. `timeoutMs` is what actually stops a run.
   *
   * No turn ceiling sits beside them because there is none to set —
   * `@dynamicagents/plugins/claude-code` does not pass `--max-turns` at all, and
   * its README carries the reason.
   */
  maxSubagentDepth: 1,
  maxConcurrentSubagents: 4,

  /**
   * How the session answers its own permission prompts. The plugin already
   * defaults to this value; the line is here because the block above claims to
   * be **the whole list**, and a setting this consequential resolving out of
   * sight would make that claim false.
   *
   * `bypassPermissions` because `claude -p` is headless: there is nobody to
   * answer a prompt, so any mode that would ask **auto-denies** instead. On the
   * CLI's default a session reads the repository perfectly, cannot change one
   * byte of it, and reports prose that reads like considered reluctance rather
   * than a blocked tool — it exits 0 and the subtask is recorded as completed.
   * This deployment lost a day to exactly that, with the container working fine
   * underneath it.
   *
   * The container is what makes bypassing acceptable rather than merely
   * convenient: it holds no credential — the egress gateway swaps the real one
   * in on the Worker side — and `npm ci` already runs whatever `postinstall` a
   * cloned repository ships. Containment is the credential swap.
   */
  permissionMode: "bypassPermissions"
  // The omitted ones are the host's to answer, not settings: the credentials,
  // and the seams that route a subtask to its workspace and release it. See
  // `src/agents/leader/claude-code.ts`.
} as const satisfies Omit<
  ClaudeCodeConfig,
  | "credentials"
  | "workspaceName"
  | "subtaskWorkspace"
  | "releaseSubtaskWorkspace"
  | "abortSubtaskWorkspace"
  | "failSubtaskWorkspace"
>;

/**
 * `@dynamicagents/plugins/recall` tuning.
 *
 * The embedding model's output dimension and metric must match the Vectorize
 * index, which `scripts/deploy.mjs` creates as `--dimensions=1024
 * --metric=cosine`. Changing the model means changing both and recreating the
 * index.
 */
export const RECALL = {
  embeddingModelId: "@cf/baai/bge-m3",
  topK: 5,
  /**
   * Max chars of a message stored in its vector metadata, under Vectorize's
   * ~10 KiB/vector limit. Recall returns this snippet plus provenance, not the
   * full original message.
   */
  metadataTextMax: 2000
} as const satisfies RecallTuning;
