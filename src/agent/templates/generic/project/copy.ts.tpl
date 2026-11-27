import {
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
    "I finished, but had nothing to report. Ask again if you expected an answer."
};

/**
 * When to ask the person, for every soul. `ask_user`'s own description says
 * what the call does; this says when it is worth a person's attention.
 */
export const ASK_GUIDANCE = `## When only the person can tell you

\`${ASK_USER_TOOL_NAME}\` puts your questions to the person who made this request and stops. Ask when you cannot go on well without something only they can give you: a choice between options that would each change what you do, a fact that is nowhere you can look, or a go-ahead for something they may not want. Do not ask what you can look up, work out, or reasonably assume — say what you assumed instead.`;

/**
 * When to wait, for an agent that has `check_back`. Not in this agent's soul
 * yet: add it to `SOUL` when there is something it has to wait on. The two
 * failures to write against are waiting *instead of working*, where each pause
 * reads as progress, and answering *instead of waiting*, where the reply calls
 * the work done pending a review nobody has read.
 */
export const WAIT_GUIDANCE = `## When you are waiting on something

\`${CHECK_BACK_TOOL_NAME}\` ends this turn and wakes you on the same request later, with the reason you gave. Use it for something you cannot hurry and can look at again — a review being written, a build, a deploy. **When you wake, check the thing you named before deciding anything else.** Never use it to pause between steps you could take now; if you are waiting on a person rather than an event, that is \`${ASK_USER_TOOL_NAME}\`.`;

/**
 * Ahead of a job's second attempt. A pipeline runs a failed step once more, in
 * the same conversation, so without this the model meets its request twice.
 */
export const RETRY_BRIEF =
  "Your previous attempt at this stopped before it finished. Its work is kept: what it said and did is above. Look at what it left first, and carry on from there rather than starting again.";
