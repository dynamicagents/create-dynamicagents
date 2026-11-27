import { TaskHost } from "@dynamicagents/core/task";
import { copy } from "@/copy";

/**
 * This tenant's task host: it owns each A2A task, keyed by the verified caller,
 * and `$WORKFLOW_CLASS` (`./workflow.ts`) runs it as steps. The mechanism is
 * core's `/task`; what is here is the words it says and the bindings it uses.
 *
 * **Cancellation is decided by core's guarded write, never by a probe.** The
 * ledger flips a task to `canceled` in one write and refuses every later write
 * against it, saying so. A hook added here runs after that flip and acts on it;
 * it never reads the task first and decides.
 *
 * Both bindings are typed `: string` rather than inferred, so a test can
 * subclass this host and point it at a scripted pipeline — `test/worker.ts`
 * does exactly that.
 */
export class $HOST_CLASS extends TaskHost<Env> {
  protected readonly copy = copy;
  // $block HOST_BINDINGS
}
