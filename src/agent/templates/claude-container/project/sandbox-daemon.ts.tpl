/**
 * The sandbox image's entrypoint: the harness daemon, serving Claude Code as
 * each session's CLI. Node, not a Worker (`scripts/build-daemon.mjs` bundles
 * it for the `Dockerfile`), so it imports nothing that reaches the Worker's
 * bindings, and its relative imports are to modules with none.
 *
 * A session here answers in prose, so no answer schema is compiled in. The
 * credential and the hosts are not here at all: they are the egress's, on the
 * Worker side.
 */
import { claudeCodeDaemonCli } from "@dynamicagents/plugins/claude-code/daemon";
import { serveSandboxDaemon } from "@dynamicagents/plugins/sandbox/daemon";
import { CLAUDE_CODE_SESSION, SANDBOX_ADAPTER } from "./config";

await serveSandboxDaemon({
  cli: claudeCodeDaemonCli({
    id: SANDBOX_ADAPTER,
    schemas: {},
    model: CLAUDE_CODE_SESSION.model,
    effort: CLAUDE_CODE_SESSION.effort,
    permissionMode: CLAUDE_CODE_SESSION.permissionMode,
    maxSubagentDepth: CLAUDE_CODE_SESSION.maxSubagentDepth,
    maxConcurrentSubagents: CLAUDE_CODE_SESSION.maxConcurrentSubagents
  })
});
