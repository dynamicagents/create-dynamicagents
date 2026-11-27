import {
  artifactViewerUrl,
  requireArtifactsStub
} from "@dynamicagents/core/artifacts";
import { tool, type Tool } from "ai";
import { z } from "zod";
import type { sandboxExec } from "@dynamicagents/plugins/sandbox";
import { SCRATCH_DIR } from "@/workspace/scratch";

/**
 * `share_file`: how a file a session made reaches the person.
 *
 * Nothing a session writes leaves the container on its own, and the person
 * cannot reach the container. So a file is read out of the scratchpad and filed
 * as an artifact, a page anyone holding its link can read, which is the store
 * core already keeps for transcripts and which the Worker already serves.
 *
 * UTF-8 text only, and bounded: an artifact entry is text, and a page is for
 * reading. A file past {@link MAX_BYTES} is shared cut, and says so.
 */

/** The artifact kind a shared file is filed under. */
const SHARED_FILE_KIND = "file";

/** The most of a file one page holds. */
const MAX_BYTES = 256 * 1024;

/** A path inside the scratchpad: relative, and never climbing out of it. */
const SHARE_INPUT = z.object({
  path: z
    .string()
    .min(1)
    .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), {
      error: "a path relative to the scratchpad, without `..`"
    })
    .describe("The file's path, relative to the scratchpad.")
});

export function shareFileTool(config: {
  exec: ReturnType<typeof sandboxExec>;
  env: Env;
  owner: () => string;
  origin: () => string | undefined;
}): Tool {
  return tool({
    description:
      "Share a text file from the scratchpad with the person: it is filed on a page of its own and you get its link. Use it for every file a session made that the person should have, then give them the link. UTF-8 text only, and at most 256 KB.",
    inputSchema: SHARE_INPUT,
    execute: async ({ path }) => {
      // The path travels as an environment variable rather than in the command,
      // so no quoting decides what the shell reads. The bytes come back as
      // base64 because a command's output reaches here already decoded as
      // UTF-8, lossily: a byte that is not UTF-8 would arrive as U+FFFD, three
      // bytes long, and the file would be shared mangled and measured wrong.
      const read = await config.exec(
        `set -o pipefail; head -c ${MAX_BYTES + 1} -- "$SHARE_PATH" | base64 -w 0`,
        { cwd: SCRATCH_DIR, env: { SHARE_PATH: path } }
      );
      if (!read.success) {
        return `Could not read \`${path}\` in the scratchpad: ${read.stderr.trim() || `exit ${read.exitCode}`}`;
      }
      const bytes = Uint8Array.from(atob(read.stdout.trim()), (c) =>
        c.charCodeAt(0)
      );
      if (bytes.includes(0)) {
        return `\`${path}\` is not a text file, and only text can be shared.`;
      }
      // Measured in bytes, as `head -c` counted them. A cut ends on a whole
      // character, because a streaming decode holds back a partial one; any
      // other byte that is not UTF-8 refuses the file rather than mangle it.
      const cut = bytes.length > MAX_BYTES;
      let text: string;
      try {
        text = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: false
        }).decode(cut ? bytes.subarray(0, MAX_BYTES) : bytes, { stream: cut });
      } catch {
        return `\`${path}\` is not UTF-8 text, and only UTF-8 text can be shared.`;
      }

      const store = requireArtifactsStub(config.env);
      const id = await store.createArtifact(
        SHARED_FILE_KIND,
        undefined,
        config.owner()
      );
      await store.addEntry(
        id,
        { label: path, text },
        { owner: config.owner() }
      );

      const origin = config.origin();
      const where = origin
        ? artifactViewerUrl(origin, id)
        : `artifact \`${id}\``;
      return `Shared \`${path}\`${cut ? " (cut at 256 KB)" : ""}: ${where}. Give the person this link.`;
    }
  });
}
