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

/** The sandbox namespace, as this Worker's `Env` spells it. */
export type SandboxNamespace = DurableObjectNamespace<
  SandboxExecHost & Rpc.DurableObjectBranded
>;

/**
 * The environment every command in a sandbox runs under, a shell's and a
 * session's alike, beside what the egress rules add.
 *
 * Nobody is at the terminal: `CI` makes a tool that would stop to ask or draw
 * a progress bar run through instead. The scratchpad is a git repository, so
 * `HUSKY=0` keeps a package a session installs there from adding git hooks
 * that every later commit in it would run. `--use-openssl-ca` because Node
 * keeps its own CA list, and an intercepted HTTPS host is signed by the
 * runtime's CA, which the sandbox trusts in the system store. The author is
 * `./git-identity.ts`'s, the same one the scratchpad's own commits carry.
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
 * The sandbox's config: what the class passes, plus the environment above and
 * where the scratchpad is backed up.
 */
export function sandboxConfigFor(
  env: Env,
  ctx: DurableObjectState,
  own: Omit<SandboxObjectConfig, "env" | "backups"> & {
    /** The prefix under `SANDBOX_BACKUPS` this class backs up to. */
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
 * A shell for the scratchpad and this Worker's own scripts, in the sandbox
 * `name` resolves. `bash` because `/bin/sh` is dash on Debian, and a model writing
 * shell writes bash: `${PIPESTATUS[0]}` fails a line under dash with exit 2.
 */
export function sandboxShell(binding: SandboxNamespace, name: () => string) {
  return sandboxExec({ binding, sandboxName: name, shell: "bash" });
}
