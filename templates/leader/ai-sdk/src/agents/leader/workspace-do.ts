import {
  WorkspaceObjectBase,
  type WorkspaceObjectConfig
} from "@dynamicagents/plugins/computer";
import { INSTALL_PLAN } from "@/workspace/install-plan";
import { gitIdentity } from "@/workspace/git-identity";

/**
 * The leader's workspace, bound as `LEADER_WORKSPACE`.
 *
 * Everything this object does lives in `@dynamicagents/plugins/computer`: one
 * Durable Object, one container, one repository, with the checkout in SQLite and
 * `computerd` mounting it over FUSE at `/workspace`. What is *this agent's* is
 * the config below, which is why it is a subclass rather than the shared class
 * bound directly.
 */
export class LeaderWorkspaceDO extends WorkspaceObjectBase {
  protected workspaceConfig(): WorkspaceObjectConfig {
    return {
      binding: "LEADER_WORKSPACE",
      label: "leader-workspace",
      installPlan: INSTALL_PLAN,
      /**
       * `direct` — the container's own network position.
       *
       * Deliberately **not** `http-gateway`. That mode routes every outbound
       * request through a Worker `Fetcher`, and this agent has no reason to put
       * itself on that path: it holds no credential the container needs, since
       * `/repo` runs clone, fetch and push as isomorphic-git inside this object.
       * The Claude Code harness is what needs it, and for exactly one reason —
       * swapping a credential the container must never hold.
       */
      egress: { mode: "direct" },
      // Which binding holds the credential git runs under, and who a commit
      // made on this side is attributed to. The binding is named rather than
      // read because `workspaceConfig()` is reachable over RPC — the base class
      // carries the reasoning on `tokenBinding`.
      git: { tokenBinding: "GITHUB_TOKEN", author: gitIdentity(this.env) }
    };
  }
}
