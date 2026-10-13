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
  /** Compact once the conversation's estimate crosses this. */
  compactAfterTokens: number;
  /** The recent tail compaction keeps verbatim. */
  keepRecentTokens: number;
}

/**
 * Tight on purpose$WHY_TIGHT.
 * Raise `compactAfterTokens` when the agent keeps losing something it needed,
 * and watch what the turn costs.
 */
export const TUNING: AgentTuning = {
  modelId: $MODEL_ID,
  compactionModelId: $MODEL_ID,
  compactAfterTokens: 16_000,
  keepRecentTokens: 5_000
};
