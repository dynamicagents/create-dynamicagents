import type { AgentSpec } from "../../spec.js";
import { MODELS_URL } from "../../../train.js";
import { quoted } from "../text.js";

/**
 * `<dir>/tuning.ts` — the numbers.
 *
 * In the agent's own directory rather than a shared config file, and that is a
 * merge decision: everything specific to this agent is in one folder, so taking
 * it into another Worker later is a folder move plus wiring, with no shared
 * file to reconcile.
 */
export const tuningTs = (spec: AgentSpec): string => `/**
 * What this agent tunes. Core ships no numbers, so each one here is chosen.
 *
 * Plain exported values rather than anything resolved at import time: on
 * Workers there is no \`env\` at module scope, and the classes read these when an
 * object runs.
 */
export interface AgentTuning {
  /**
   * The Workers AI model the turn runs on. It must call tools reliably over a
   * long context, because a turn ends when the model stops calling them.
   * Every id is at ${MODELS_URL}
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
 * Tight on purpose${spec.subAgent ? ": a delegating agent accumulates sub-agent results fast" : ": a long history is re-sent on every call of the turn"}.
 * Raise \`compactAfterTokens\` when the agent keeps losing something it needed,
 * and watch what the turn costs.
 */
export const TUNING: AgentTuning = {
  modelId: ${quoted(spec.modelId)},
  compactionModelId: ${quoted(spec.modelId)},
  compactAfterTokens: 16_000,
  keepRecentTokens: 5_000
};
`;
