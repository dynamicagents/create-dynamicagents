/**
 * What one `npm create dynamicagents agent` run decides, and the names derived
 * from it. Pure data: every template is a function of this, so a spec can build
 * one and read what would be written without a process.
 */

/** A capability the scaffold can install whole — plugin, binding and skill. */
export type Capability = "browser";

export interface AgentSpec {
  /**
   * The tenant id — a **public identifier**. A gatekeeper registers against it
   * and it rides in a JWT claim, so renaming one later is a re-registration,
   * not a refactor. Every class, binding and workflow name derives from it.
   */
  tenant: string;
  /** The name on the agent card, e.g. `Support Agent`. */
  name: string;
  /** One line: what it does. Goes on the card and seeds the soul. */
  description: string;
  /** Which agent this was created from — see `./blueprints.ts`. */
  blueprint: string;
  /** Whether it delegates to the `general` sub-agent. */
  subAgent: boolean;
  /** Installed capabilities, in the order they are offered. */
  capabilities: readonly Capability[];
  /** The Workers AI model id for the turn and for compaction. */
  modelId: string;
  /** The Workers compatibility date `wrangler.jsonc` declares. */
  compatibilityDate: string;
}

/**
 * Every identifier a generated project spells more than once, derived from the
 * tenant id in one place.
 *
 * Deriving them rather than asking is what keeps a later merge of two generated
 * projects mechanical: two agents with different tenant ids cannot collide, and
 * nothing in a merge has to be renamed. `names()` in `./names.ts` is the only
 * thing that builds one.
 */
export interface AgentNames {
  /** The tenant id, as given. */
  tenant: string;
  /** `claude-coordinator` → `ClaudeCoordinator`. */
  pascal: string;
  /** `claude-coordinator` → `claudeCoordinator`. The `defineAgent` export. */
  camel: string;
  /** `claude-coordinator` → `CLAUDE_COORDINATOR`. */
  screaming: string;
  /** Where the agent's own files live, relative to the project root. */
  dir: string;
  /** The task host class, and its Durable Object binding. */
  hostClass: string;
  /** The pipeline class. */
  workflowClass: string;
  /** The step agent class, and its Durable Object binding. */
  agentClass: string;
  /** The sub-agent class. A facet: exported, never bound in production. */
  childClass: string;
  /** The workflow's binding, as `wrangler.jsonc` and the host spell it. */
  workflowBinding: string;
  /** The workflow's name in the account. A merge never renames it. */
  workflowName: string;
}
