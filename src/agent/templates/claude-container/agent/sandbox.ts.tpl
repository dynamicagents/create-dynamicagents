import {
  credentialHost,
  type CredentialLease,
  type Lead
} from "@dynamicagents/plugins/claude-code";
import {
  DEFAULT_INSTALL_PLAN,
  SandboxObjectBase,
  type SandboxObjectConfig
} from "@dynamicagents/plugins/sandbox";
import { CLAUDE_CONTAINER_SANDBOX_INSTANCE, SANDBOX_ADAPTER } from "@/config";
import { sandboxConfigFor } from "@/workspace/container";
import { claudeCredentials, CREDENTIALS_KEY } from "./claude-code";
import { CLAUDE_CONTAINER_EGRESS } from "./egress";

/**
 * `claude-container`'s sandbox, bound as `CLAUDE_CONTAINER_SANDBOX`: one
 * container per caller, whose disk holds the caller's scratchpad, and the
 * Claude Code sessions that run in it.
 *
 * Everything a sandbox does is `@dynamicagents/plugins/sandbox`'s. What is this
 * agent's: the hosts its sessions reach (`./egress.ts`), and the Anthropic
 * credential pool those reach Anthropic with, in this object's own storage —
 * the egress leases from the sandbox a request came from, so the container
 * never holds a credential.
 */
export class ClaudeContainerSandbox
  extends SandboxObjectBase<Env>
  implements CredentialLease
{
  /**
   * Per sandbox, deliberately. Every sandbox draws the same subscription
   * buckets, so the strictly-correct home is one object they all consult; one
   * each costs a wasted `429` per sandbox per rotation, bounded by how many
   * run at once, which is far cheaper than a class, a binding and an RPC on the
   * rotation path.
   */
  readonly #pool = credentialHost({
    storage: this.ctx.storage,
    credentials: () => claudeCredentials(this.env),
    key: CREDENTIALS_KEY
  });

  protected sandboxConfig(): SandboxObjectConfig {
    return sandboxConfigFor(this.env, this.ctx, {
      label: "claude-container-sandbox",
      adapter: SANDBOX_ADAPTER,
      instance: CLAUDE_CONTAINER_SANDBOX_INSTANCE,
      // The plugin requires one, and installs only on a repository checkout:
      // the scratchpad is not one, so nothing here ever runs it.
      installPlan: DEFAULT_INSTALL_PLAN,
      egress: {
        entrypoint: this.ctx.exports.ClaudeContainerEgress,
        self: "CLAUDE_CONTAINER_SANDBOX",
        rules: CLAUDE_CONTAINER_EGRESS
      },
      backupPrefix: "claude-container/"
    });
  }

  // The pool, as `claudeCodeEgress` leases from it.

  async lead(): Promise<Lead> {
    return this.#pool.lead();
  }

  async spend(id: string, resetAt: number): Promise<Lead> {
    return this.#pool.spend(id, resetAt);
  }

  async reject(id: string): Promise<Lead> {
    return this.#pool.reject(id);
  }

  /**
   * Admit a session: forget the pool's marks, so its first model call asks
   * Anthropic again — `admit` in `@dynamicagents/plugins/claude-code` says why.
   * Called before a session is dispatched, by `prepareSession` in
   * `./children.ts`.
   */
  async claudeAdmit(): Promise<Lead> {
    return this.#pool.admit();
  }
}
