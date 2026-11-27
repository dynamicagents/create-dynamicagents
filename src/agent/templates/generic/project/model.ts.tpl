import { isPlatformTransientError } from "agents";
import type { ChatErrorClassification } from "@cloudflare/think";
import type { LanguageModel } from "ai";
import {
  gatewayLogFields,
  workersAIModel,
  type GatewayCorrelation
} from "@dynamicagents/core/model";

/**
 * The one model an agent or a sub-agent runs, as its `getModel()` returns it.
 *
 * One function for every class in this project, because what each call tells AI
 * Gateway about itself has to be spelled the same way everywhere or a log filter
 * on it silently misses the classes that spelled it differently.
 *
 * `sessionAffinity` is the object's name: every call an object makes re-sends
 * one history, so anything finer routes a call away from the prefix it is about
 * to re-send.
 *
 * There is no model credential anywhere in this project. Workers AI is reached
 * through the `AI` binding, which Cloudflare authenticates for the Worker.
 */
export function agentModel(
  env: Env,
  model: { modelId: string; name: string },
  correlation: GatewayCorrelation
): LanguageModel {
  return workersAIModel(env, {
    modelId: model.modelId,
    sessionAffinity: model.name,
    ...gatewayLogFields(correlation)
  });
}

/**
 * A turn the platform cut, as Think's error classification spells it, or
 * `undefined` for an error this project has nothing to add about.
 *
 * Every class that runs a turn answers `classifyChatError` with
 * `transientChatError(error) ?? super.classifyChatError(error)`, and it is one
 * function here rather than that condition written out in each of them for the
 * reason {@link agentModel} gives: this file is the same in every generated
 * project, so a class that spelled it differently — a sub-agent added later, a
 * second agent merged in — would fail a turn the others continue, and nothing
 * would say so.
 *
 * **Why core leaves it here.** Think continues a turn whose stream errored only
 * for `"transient"` or `"rate_limit"`; anything else, `undefined` included,
 * ends it. Core answers with the bundled context-overflow classifier alone, and
 * deliberately: the errors a dropped connection arrives as belong to the
 * provider and the platform a deployment chose, so matching them on every
 * tenant's behalf is the line core does not cross. This project is that
 * deployment. Without this, a stream that dies mid-answer ends its turn and
 * fails its step job, and the work carries on through the workflow's retry of
 * the whole step rather than through a continuation — the partial answer the
 * turn had already produced is what that costs.
 *
 * **The shape is the platform's, not the provider's.** A disconnect is a
 * transport failure, so there is no provider-specific string to match: what
 * surfaces is the runtime's own message for a connection that died.
 * `isPlatformTransientError` is the predicate `agents` maintains for exactly
 * that family — connection lost, an isolate a deploy superseded, a storage
 * reset, and anything the platform flags retryable short of an overload — and
 * it reads an `Error`, a string and a `cause` chain alike, which is what a
 * wrapper like `SqlError` makes necessary. Matching strings here instead would
 * put a copy of that list in this project, to go stale on the next runtime
 * message. And it applies whichever model the agent runs: the model id is a
 * value in `tuning.ts`, so an agent pointed at another one tomorrow would
 * otherwise lose this silently.
 *
 * **What it costs, accepted.** A *fatal* error whose message matches this
 * family is now retried: Think continues the turn up to its `chatRecovery`
 * attempt budget, which core leaves at Think's own default, before ending it.
 * So a permanently broken connection spends that budget before the step job
 * fails and the workflow retries it. The trade is deliberate — the budget is
 * bounded and a dropped stream is common, while an error that both looks like a
 * disconnect and is permanent is neither.
 */
export function transientChatError(
  error: unknown
): ChatErrorClassification | undefined {
  return isPlatformTransientError(error) ? "transient" : undefined;
}

/**
 * The task a sub-agent's turn is for. Core stamps it on the dispatch's
 * `turnMetadata`, where Think keeps it for a recovered turn too.
 */
export function turnTask(metadata: unknown): string | undefined {
  const taskId = (metadata as { taskId?: unknown } | undefined)?.taskId;
  return typeof taskId === "string" ? taskId : undefined;
}
