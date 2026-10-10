/**
 * Installing a written project, and nothing else.
 *
 * Thin on purpose: what to install is `src/train.ts`'s and the manifest the
 * templates wrote, and **npm is what validates it** — it owns semver, so a pin
 * that no longer satisfies the train's own declarations is an `ERESOLVE` here
 * rather than a guess this CLI made about ranges.
 *
 * There is no offline path: someone running `npm create dynamicagents` is
 * already pulling this package over the network, so a machine that cannot reach
 * the registry is an error rather than a mode to write code for.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** npm is slow on a cold cache, and a timeout here looks like a hang. */
const NPM_TIMEOUT_MS = 10 * 60_000;

/**
 * Whether an npm invocation has to go through a shell. Pure and exported, so
 * the one platform rule in this file has a spec rather than only a comment.
 *
 * On Windows npm is `npm.cmd`, a batch script — and a batch script is not an
 * executable: Node refuses to spawn one without a shell, so running `npm`
 * directly there fails with `EINVAL` on a platform this CLI otherwise supports.
 * True hands the command to `cmd.exe` instead, which is what `execFile` does
 * with `shell`. POSIX keeps the direct execution, with no shell in between.
 */
export const needsShell = (platform: NodeJS.Platform): boolean =>
  platform === "win32";

/**
 * One npm invocation.
 *
 * Every argument is a literal this file wrote — nothing a user typed reaches
 * it — which is what makes {@link needsShell}'s shell harmless: there is no
 * value here that would need quoting.
 *
 * Output is captured rather than inherited, because a spinner is on the line —
 * and reported on failure, where the last few lines of npm's own diagnosis are
 * what somebody needs.
 */
async function npm(args: string[], cwd: string): Promise<void> {
  try {
    await run("npm", args, {
      cwd,
      timeout: NPM_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      shell: needsShell(process.platform)
    });
  } catch (err) {
    const { stderr, message } = err as { stderr?: string; message: string };
    const detail = (stderr ?? "").trim().split("\n").slice(-12).join("\n");
    throw new Error(
      `\`npm ${args.join(" ")}\` failed.\n\n${detail === "" ? message : detail}`
    );
  }
}

/**
 * Install the project and generate its Worker types.
 *
 * `wrangler types` matters as much as the install: `tsconfig.json` names
 * `worker-configuration.d.ts`, so without it the project's first `tsc` fails on
 * a file the dev never wrote.
 */
export async function installProject(
  dir: string,
  report: (step: string) => void
): Promise<void> {
  report("Installing dependencies");
  await npm(["install", "--no-audit", "--no-fund"], dir);
  report("Generating Worker types");
  await npm(["exec", "--", "wrangler", "types"], dir);
}
