import type { CoreConfigOverrides } from "@dynamicagents/core";
import { PARENT_MODEL } from "@/harness";

/**
 * Every value this agent tunes that does not depend on its subtask harness.
 * What does — the parent's model pair, and the harness's own tuning — is in
 * `src/harness.ts`.
 *
 * Core owns the shapes and a working baseline (`DEFAULT_CORE_CONFIG`); this is
 * only what the deployment wants different, merged and validated once per
 * Durable Object by `resolveConfig`. These stay plain exported values because a
 * config resolved at import time freezes before `env` exists — which on Workers
 * is always.
 *
 * Nothing here is a platform fact: chunk sizing, step timeouts and the rest live
 * in core's `platform.ts` and are deliberately not tunable.
 */

/**
 * The model pair and the AI Gateway this agent is billed and correlated
 * through. **You must choose these — core ships no default.**
 *
 * The primary is picked for reliable multi-tool-call behaviour over long
 * contexts, which is what a delegating round is: a round ends only when the
 * model calls a control tool, and one that answers in prose instead burns the
 * whole budget reaching no ending.
 *
 * The fallback is the primary's **full-size sibling**, not another vendor: it
 * buys depth on a round the
 * flash model could not hold together, and gives up independence, since an
 * outage or rate limit is correlated within a family and takes both down. Core
 * refuses only an identical pair — point the fallback at another family if a
 * vendor-wide failure would cost more than a weaker second attempt.
 *
 * Both must support function calling and tolerate a long system prompt. After
 * changing either, re-read `mainAgentLimits.maxTurns`: a model needing more steps
 * to reach an ending spends the same budget faster.
 */
export const MODEL = {
  chatModelId: "@cf/zai-org/glm-5.3-flash",
  fallbackChatModelId: "@cf/zai-org/glm-5.3",
  /** AI Gateway slug; `"default"` auto-provisions on first request. */
  aiGatewayId: "default",
  // Coupled to `reasoningEffort`: reasoning is spent against this before the
  // tool call that ends a round, and a coding round writes a file and a test on
  // top of it. A truncated round or patch reads as a finished one.
  maxOutputTokens: 32_000,
  reasoningEffort: "high"
} as const;

/**
 * The leader: long rounds, few subtasks, and a real container underneath.
 *
 * Turns and wall clock are generous because a coding round is slow — a container
 * boot, an install, a test suite — and a tight budget kills the agent mid-build.
 * `maxSubtasks` is small for the opposite reason: coding subtasks are *heavy*,
 * not numerous, and eight parallel subagents editing one checkout is a merge
 * conflict, not fan-out.
 *
 * `toolOutputWindow` and `roundObservationWindow` are wide for one reason: what
 * the model can no longer see it pays a container round trip to rediscover. A
 * build log falls out of the first; a failing test or a refused clone from two
 * rounds back, still true against the same checkout, falls out of the second.
 *
 * Do not point the parent at a Claude model: this loop runs on Workers AI, and
 * Claude is reached only by the Claude Code harness, from inside a container
 * that never holds the credential.
 */
export const LEADER_CONFIG: CoreConfigOverrides = {
  model: { ...MODEL, ...PARENT_MODEL },
  // The deferral allowance. It exists for a specific wait: a pull request is opened, a review is
  // requested automatically, and it lands somewhere between two and five minutes
  // later — so the work is not finished, nothing has failed, and there is nobody
  // to ask.
  //
  // Sized against that wait rather than a round: 30 seconds is the floor a review
  // is worth polling at, fifteen minutes is when one that never started is not
  // going to, and 30 of those checks is the fifteen minutes. The allowance is
  // twice that because one task legitimately opens more than one pull request,
  // and running out mid-wait costs the agent the answer it was two checks from.
  //
  // The *time* is free — a parked round is not charged to `maxWallMs`. The
  // *checks* are: every round is charged its turns, the one that waits and each
  // one that wakes to look, and a poll is about two. So a review polled every 30
  // seconds for its full fifteen minutes spends about 60 turns, and `maxTurns` is
  // twice the working budget to carry one such wait beside the work
  // rather than instead of it — which makes turns, not `maxDeferrals`, the bound
  // a long run of short polls meets first.
  //
  // Both deferral bounds must be positive or the tool is not offered at all, and
  // `roundObservationWindow` must be too, since that is what carries the record
  // of having waited into the round that wakes.
  mainAgentLimits: {
    maxTurns: 120,
    maxWallMs: 3 * 60 * 60_000,
    maxDeferrals: 60,
    maxDeferredMs: 30 * 60_000
  },
  subagentLimits: { maxTurns: 80, maxWallMs: 90 * 60_000 },
  toolOutputWindow: 6,
  roundObservationWindow: 3,
  maxSubtasks: 4,
  session: {
    memoryMaxTokens: 2_000,
    compactAfterTokens: 60_000,
    compactTailTokens: 12_000
  }
};
