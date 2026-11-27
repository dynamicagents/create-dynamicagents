import { WorkerEntrypoint } from "cloudflare:workers";
import type { EgressRoute } from "agents/harness/container";
import { claudeCodeEgress } from "@dynamicagents/plugins/claude-code";
import {
  sandboxEgress,
  type SandboxEgressRule
} from "@dynamicagents/plugins/sandbox";

/**
 * What `claude-container`'s sandboxes may reach as the deployment, each host
 * declared by the plugin that needs it. `./sandbox.ts`'s config and the
 * entrypoint below both read this one list, so what is intercepted and what
 * serves it cannot disagree.
 *
 * A session is Claude Code, which reaches Anthropic through the CLI's
 * placeholder host; the credential is swapped in here, on the Worker side.
 *
 * **Every other host is reached directly, unrestricted.** A restriction that
 * forgot a host would stop an install dead, inside a `postinstall` whose error
 * names no egress. What that gives up is a bound on exfiltration (the container
 * can send what it holds anywhere), and what holds is that it holds no
 * credential.
 */
export const CLAUDE_CONTAINER_EGRESS: readonly SandboxEgressRule[] = [
  claudeCodeEgress({ label: "claude-container-egress" })
];

/** Where those hosts are intercepted to. `src/index.ts` exports it, so it is on `ctx.exports`. */
export class ClaudeContainerEgress extends WorkerEntrypoint<
  Env,
  { routes: readonly EgressRoute[] }
> {
  override fetch(request: Request): Promise<Response> {
    return sandboxEgress(
      request,
      this.ctx.props.routes,
      this.env as unknown as Readonly<Record<string, unknown>>,
      CLAUDE_CONTAINER_EGRESS
    );
  }
}
