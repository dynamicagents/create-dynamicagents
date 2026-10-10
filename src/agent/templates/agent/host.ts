import type { AgentNames } from "../../spec.js";
import { assigned } from "../text.js";

/** `<dir>/host.ts` — core's `TaskHost`, which owns each A2A task. */
export const hostTs = (n: AgentNames): string => {
  const bindings = [
    assigned("protected readonly workflowBinding: string", n.workflowBinding),
    assigned("protected readonly hostBinding: string", n.hostClass)
  ].join("\n");

  return `import { TaskHost } from "@dynamicagents/core/task";
import { copy } from "@/copy";

/**
 * This tenant's task host: it owns each A2A task, keyed by the verified caller,
 * and \`${n.workflowClass}\` (\`./workflow.ts\`) runs it as steps. The mechanism is
 * core's \`/task\`; what is here is the words it says and the bindings it uses.
 *
 * **Cancellation is decided by core's guarded write, never by a probe.** The
 * ledger flips a task to \`canceled\` in one write and refuses every later write
 * against it, saying so. A hook added here runs after that flip and acts on it;
 * it never reads the task first and decides.
 *
 * Both bindings are typed \`: string\` rather than inferred, so a test can
 * subclass this host and point it at a scripted pipeline — \`test/worker.ts\`
 * does exactly that.
 */
export class ${n.hostClass} extends TaskHost<Env> {
  protected readonly copy = copy;
${bindings}
}
`;
};
