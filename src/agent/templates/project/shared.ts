/**
 * The two modules outside the agent's own directory that belong to no agent in
 * particular: the words every soul and every task shares, and how a model is
 * reached.
 *
 * **Both are constants, and that is deliberate.** Nothing in them names a
 * tenant, so every project this CLI generates has the same two files — which is
 * what makes a later merge of two generated projects have nothing to reconcile
 * here. Anything agent-specific goes in the agent's own directory instead; see
 * `../../merge-notes.ts`.
 *
 * Escaping, since both hold TypeScript that itself holds template literals: a
 * backtick for the generated file is `\``, and a `${` it should keep is `\${`.
 */

/** `src/copy.ts` — what this Worker's agent says that core refuses to write. */
export const copyTs = `import {
  ASK_USER_TOOL_NAME,
  CHECK_BACK_TOOL_NAME
} from "@dynamicagents/core/agent";
import type { A2ACopy } from "@dynamicagents/core/task";

/**
 * The words this Worker's agents say that core refuses to write: what a person
 * reads when a task ends without an answer, and the parts of a soul or a job's
 * first message that are not about one agent's domain.
 *
 * At the top level rather than inside the agent's directory because nothing
 * here names an agent — which is also what lets a second agent share it
 * unchanged.
 */

/** What a person reads when a task ends with no answer to give them. */
export const copy: A2ACopy = {
  /** A task whose steps failed. The diagnostic is logged, not shown. */
  failed: "Sorry — something went wrong handling that request.",
  /** A task that finished with nothing to say. */
  emptyReply:
    "I finished, but had nothing to report. Ask again if you expected an answer.",
  /** A question that went unanswered. Nothing failed: the agent stopped rather than guess. */
  questionExpired:
    "I stopped here: I asked you a question and didn't hear back in time. Send the request again whenever you're ready."
};

/**
 * When to ask the person, for every soul. \`ask_user\`'s own description says
 * what the call does; this says when it is worth a person's attention.
 */
export const ASK_GUIDANCE = \`## When only the person can tell you

\\\`\${ASK_USER_TOOL_NAME}\\\` puts one question to the person who made this request and stops. Ask when you cannot go on well without something only they can give you: a choice between options that would each change what you do, a fact that is nowhere you can look, or a go-ahead for something they may not want. Do not ask what you can look up, work out, or reasonably assume — say what you assumed instead. Ask one question with everything you need in it, and offer options when the possible answers are few.\`;

/**
 * When to wait, for an agent that has \`check_back\`. Not in this agent's soul
 * yet: add it to \`SOUL\` when there is something it has to wait on. The two
 * failures to write against are waiting *instead of working*, where each pause
 * reads as progress, and answering *instead of waiting*, where the reply calls
 * the work done pending a review nobody has read.
 */
export const WAIT_GUIDANCE = \`## When you are waiting on something

\\\`\${CHECK_BACK_TOOL_NAME}\\\` ends this turn and wakes you on the same request later, with the reason you gave. Use it for something you cannot hurry and can look at again — a review being written, a build, a deploy. **When you wake, check the thing you named before deciding anything else.** Never use it to pause between steps you could take now; if you are waiting on a person rather than an event, that is \\\`\${ASK_USER_TOOL_NAME}\\\`.\`;

/**
 * Ahead of a job's second attempt. A pipeline runs a failed step once more, in
 * the same conversation, so without this the model meets its request twice.
 */
export const RETRY_BRIEF =
  "Your previous attempt at this stopped before it finished. Its work is kept: what it said and did is above. Look at what it left first, and carry on from there rather than starting again.";
`;

/** `src/model.ts` — the one model an agent or a sub-agent runs. */
export const modelTs = `import type { LanguageModel } from "ai";
import {
  gatewayLogFields,
  workersAIModel,
  type GatewayCorrelation
} from "@dynamicagents/core/model";

/**
 * The one model an agent or a sub-agent runs, as its \`getModel()\` returns it.
 *
 * One function for every class in this project, because what each call tells AI
 * Gateway about itself has to be spelled the same way everywhere or a log filter
 * on it silently misses the classes that spelled it differently.
 *
 * \`sessionAffinity\` is the object's name: every call an object makes re-sends
 * one history, so anything finer routes a call away from the prefix it is about
 * to re-send.
 *
 * There is no model credential anywhere in this project. Workers AI is reached
 * through the \`AI\` binding, which Cloudflare authenticates for the Worker.
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
 * The task a sub-agent's turn is for. Core stamps it on the dispatch's
 * \`turnMetadata\`, where Think keeps it for a recovered turn too.
 */
export function turnTask(metadata: unknown): string | undefined {
  const taskId = (metadata as { taskId?: unknown } | undefined)?.taskId;
  return typeof taskId === "string" ? taskId : undefined;
}
`;
