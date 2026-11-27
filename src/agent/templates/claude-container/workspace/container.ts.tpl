import {
  sandboxExec,
  type SandboxExecHost,
  type SandboxObjectConfig
} from "@dynamicagents/plugins/sandbox";
import { gitIdentity } from "./git-identity";

/**
 * Think's own file tools, which the parent's `activeTools` leave out. Think
 * adds them over the agent's workspace, which here is the object's SQLite
 * rather than the scratchpad, so none of them reaches what a session made.
 */
export const THINK_FILE_TOOLS: ReadonlySet<string> = new Set([
  "read",
  "write",
  "edit",
  "delete",
  "find",
  "ls",
  "list",
  "grep"
]);

/** A sandbox namespace, as either agent's `Env` spells it. */
export type SandboxNamespace = DurableObjectNamespace<
  SandboxExecHost & Rpc.DurableObjectBranded
>;

/**
 * The environment every command in a sandbox runs under — an `exec`, an
 * install, a session — beside what the egress rules add.
 *
 * `CI` and `HUSKY=0` because a cloned repository's install would otherwise
 * install its git hooks into the checkout, and every commit a session makes
 * would then run them. `--use-openssl-ca` because Node keeps its own CA list,
 * and an intercepted HTTPS host is signed by the runtime's CA, which the
 * sandbox trusts in the system store. The author is the one every other commit
 * in this Worker carries: see `./git-identity.ts`.
 */
export function sandboxEnv(env: Env): Record<string, string> {
  const author = gitIdentity(env);
  return {
    CI: "1",
    HUSKY: "0",
    DISABLE_AUTOUPDATER: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_PROGRESS: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    WRANGLER_SEND_METRICS: "false",
    LANG: "C.UTF-8",
    NODE_OPTIONS: "--use-openssl-ca",
    GIT_AUTHOR_NAME: author.name,
    GIT_COMMITTER_NAME: author.name,
    // Left unset rather than empty: git would accept an empty email and record
    // `<>`, while unset it falls back to what the repository's own config says.
    ...(author.email
      ? { GIT_AUTHOR_EMAIL: author.email, GIT_COMMITTER_EMAIL: author.email }
      : {})
  };
}

/**
 * A sandbox's config, from what is this agent's. One builder for both agents,
 * because the shared half — the environment, where checkouts are backed up —
 * has to be the same for every sandbox this Worker runs.
 */
export function sandboxConfigFor(
  env: Env,
  ctx: DurableObjectState,
  own: Omit<SandboxObjectConfig, "env" | "backups"> & {
    /** Under `SANDBOX_BACKUPS`, one prefix per class. */
    backupPrefix: string;
  }
): SandboxObjectConfig {
  const { backupPrefix, ...config } = own;
  return {
    ...config,
    env: sandboxEnv(env),
    backups: {
      binding: "SANDBOX_BACKUPS",
      prefix: backupPrefix,
      gateway: ctx.exports.DirectoryBackupGateway
    }
  };
}

/**
 * A shell for `/scratch` and this Worker's own scripts, in the sandbox `name`
 * resolves. `bash` because `/bin/sh` is dash on Debian, and a model writing
 * shell writes bash: `${PIPESTATUS[0]}` fails a line under dash with exit 2.
 */
export function sandboxShell(binding: SandboxNamespace, name: () => string) {
  return sandboxExec({ binding, sandboxName: name, shell: "bash" });
}
