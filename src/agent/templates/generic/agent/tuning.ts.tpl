import type { Reconcile } from "@dynamicagents/core/workflow";

/**
 * What this agent tunes. Core ships no numbers, so each one here is chosen.
 *
 * Plain exported values rather than anything resolved at import time: on
 * Workers there is no `env` at module scope, and the classes read these when an
 * object runs.
 */
export interface AgentTuning {
  /**
   * The Workers AI model the turn runs on. It must call tools reliably over a
   * long context, because a turn ends when the model stops calling them.
   * Every id is at $MODELS_URL
   */
  modelId: string;
  /**
   * The model compaction summarizes with, and **the turn waits for it** — so
   * this is a wall-clock decision on every compaction, not a detail. A smaller
   * model is the usual answer; a large conversation is where a small one starts
   * timing out.
   */
  compactionModelId: string;
  /**
   * Compact once the conversation's estimate crosses this.
   *
   * Compaction is also when Think re-renders the system prompt: until the next
   * one, the agent reads the soul and the memory as they stood when the prompt
   * was last rendered, no matter what has been deployed or written since.
   */
  compactAfterTokens: number;
  /** The recent tail compaction keeps verbatim. */
  keepRecentTokens: number;
  /**
   * How long the pipeline waits for its step job's next event before it pulls
   * the agent and the host for whatever it has not read. That is what an event
   * the platform accepts and never delivers costs: at worst `maxMs`, instead of
   * a task that waits for it forever.
   *
   * A wait that finds nothing doubles the next one, up to `maxMs`, so a
   * question left open for days costs a few hundred wakes out of the ten
   * thousand steps a Workflow instance holds. Lower `afterMs` to notice a lost
   * event sooner, at more wakes per task.
   */
  reconcile: Reconcile;
}

/**
 * Tight on purpose$WHY_TIGHT.
 * Raise `compactAfterTokens` when the agent keeps losing something it needed,
 * and watch what the turn costs.
 *
 * Watch the prompt too, not only the cost: that number is how stale a long
 * conversation's system prompt can get as much as it is how much each call
 * carries, and a conversation that never reaches it runs to its end on the
 * soul and the memory it started with.
 */
export const TUNING: AgentTuning = {
  modelId: $MODEL_ID,
  compactionModelId: $MODEL_ID,
  compactAfterTokens: 16_000,
  keepRecentTokens: 5_000,
  reconcile: { afterMs: 5 * 60_000, maxMs: 30 * 60_000 }
};
