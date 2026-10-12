import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asTenant, whyNot } from "./cli/answers";
import { needsShell } from "./cli/install";
import * as say from "./cli/messages";

/**
 * `dist/cli.js`, run the way a user runs it: one process per case, asserting
 * the exit code and what reached stdout.
 *
 * **The one spec with a process in it, and the one that needs a build.** Every
 * other spec here is about a pure function and needs neither, which is the rule
 * AGENTS.md states and the reason this is the exception rather than a crack in
 * it: an exit code and a stream are what this is about, and no pure function
 * has either. It stands in for forty lines of bash that used to live in
 * `.github/workflows/test.yml`, where an assertion cannot be reviewed in a diff
 * or run on a laptop.
 *
 * What it expects comes from the data the CLI prints from — `FLAGS`,
 * `package.json`, the messages themselves — so a flag added to the table is
 * covered here without an edit, and a reworded sentence stays `messages.spec.ts`'s
 * business. The literals that remain are the two claims that are about
 * behaviour rather than wording: that a mistyped flag is called a flag, and
 * that nothing about a terminal is said to somebody who has one.
 *
 * There is no terminal in a spawned process, which is exactly the half of the
 * CLI this can see. The other half is the re-prompt, which needs a pty vitest
 * does not have and a dependency this package will not take — so the decision
 * behind it is pinned in `cli/answers.spec.ts`, where it lives, and driven by
 * hand under `script -qec` when it changes.
 *
 * What stayed in the workflow is the one thing this cannot do: pack the tarball
 * and install it the way `npm create` does. That is about `files`, `bin` and
 * `dependencies` — not about what the bin says.
 */

const exec = promisify(execFile);

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BIN = path.join(ROOT, "dist", "cli.js");

const { version } = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf8")
) as { version: string };

/** An escape sequence, which is the one thing `--help` must not carry. */
const ESCAPE = String.fromCharCode(27);

/**
 * The newest thing the build reads, so that a `dist/` behind it is rebuilt.
 *
 * `scripts/build.mjs` is one of them: it *is* the build, and esbuild reads
 * `tsconfig.json` and the `engines` in `package.json` on the way through.
 */
function newestInput(): number {
  const inputs = [
    path.join(ROOT, "package.json"),
    path.join(ROOT, "tsconfig.json"),
    path.join(ROOT, "scripts", "build.mjs")
  ];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // A spec is not built, so editing one is not a reason to build.
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
        inputs.push(full);
      }
    }
  };
  walk(path.join(ROOT, "src"));
  return Math.max(...inputs.map((file) => statSync(file).mtimeMs));
}

/** Where every run below is spawned, so no case can touch the repository. */
let workspace: string;

beforeAll(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "create-dynamicagents-"));
  // `npm test` does not build, and this spec is about the build — so it builds
  // when `dist/` is missing or older than what it is built from, and costs
  // nothing when it is not. In CI `npm run check` has already built by here.
  if (existsSync(BIN) && statSync(BIN).mtimeMs >= newestInput()) return;
  await exec("npm", ["run", "build"], {
    cwd: ROOT,
    // The one platform rule this repository has, reused rather than copied: npm
    // is a batch script on Windows and will not spawn without a shell.
    shell: needsShell(process.platform)
  });
}, 300_000);

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

interface Run {
  /** The exit code, which is what a script reads. */
  status: number;
  stdout: string;
  stderr: string;
  /** Both streams: what somebody reads, wherever it was written. */
  said: string;
}

/**
 * One run of the built bin.
 *
 * Nothing is inherited that would change what it prints: `NO_COLOR` keeps a
 * developer's `FORCE_COLOR` out of the assertions, and stdin is a pipe, which
 * is what makes every run below one with no terminal to ask in.
 */
async function bin(...args: string[]): Promise<Run> {
  const options = {
    cwd: workspace,
    env: { ...process.env, NO_COLOR: "1" },
    // A run that waits for something has failed, rather than hanging the suite.
    timeout: 60_000
  };
  try {
    const { stdout, stderr } = await exec(
      process.execPath,
      [BIN, ...args],
      options
    );
    return { status: 0, stdout, stderr, said: stdout + stderr };
  } catch (err) {
    const failed = err as { code?: number; stdout?: string; stderr?: string };
    const stdout = failed.stdout ?? "";
    const stderr = failed.stderr ?? "";
    return { status: failed.code ?? 1, stdout, stderr, said: stdout + stderr };
  }
}

describe("--version", () => {
  it("prints the version that would publish, and nothing else", async () => {
    const run = await bin("--version");
    expect(run.status).toBe(0);
    expect(run.stdout).toBe(`${version}\n`);
    expect(run.stderr).toBe("");
  });
});

describe("--help", () => {
  it("lists every flag, and exits having asked nothing", async () => {
    const run = await bin("--help");
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.stdout).toContain(version);
    for (const flag of say.FLAGS) {
      expect(run.stdout, flag.key).toContain(flag.spelled);
    }
  });

  it("is plain, because it is read in a pipe as often as in a terminal", async () => {
    const { stdout } = await bin("--help");
    expect(stdout).not.toContain(ESCAPE);
    // Nor clack's frame, which is what the rest of the CLI prints inside.
    expect(stdout).not.toContain("┌");
    expect(stdout).not.toContain("│");
  });
});

describe("a run with no terminal to ask in", () => {
  it("refuses when an answer is missing, and names every flag", async () => {
    const run = await bin("agent");
    expect(run.status).toBe(1);
    expect(run.said).toMatch(/no terminal/i);
    for (const flag of say.FLAGS) {
      expect(run.said, flag.key).toContain(flag.spelled);
    }
  });

  it("refuses a flag it does not take, saying that and not anything about a terminal", async () => {
    const run = await bin("--hepl");
    expect(run.status).toBe(1);
    expect(run.said).toContain("`--hepl`");
    expect(run.said).toMatch(/is not a flag/);
    // The defect this is here for: every parse error used to carry "No terminal
    // to ask in", because that was the first line of the only usage message in
    // the package.
    expect(run.said).not.toMatch(/terminal/i);
  });

  it("refuses a value that will not do, naming the flag that carried it", async () => {
    const run = await bin(
      "agent",
      "generic",
      "demo",
      "--name",
      "My Agent",
      "--description",
      "A demo agent",
      "--yes"
    );
    expect(run.status).toBe(1);
    // Where it was given, rather than after every other answer — which is what
    // naming the flag shows: `plan()`'s refusal names nothing.
    expect(run.said).toMatch(/--name .* will not do/);
    const problem = whyNot(asTenant)("My Agent");
    expect(problem).toBeDefined();
    expect(run.said).toContain(problem);
    expect(run.said).not.toMatch(/terminal/i);
  });

  it("refuses a directory with something in it", async () => {
    const occupied = path.join(workspace, "occupied");
    await mkdir(occupied, { recursive: true });
    await writeFile(path.join(occupied, "something"), "", "utf8");
    const run = await bin(
      "agent",
      "generic",
      occupied,
      "--name",
      "demo",
      "--description",
      "A demo agent",
      "--yes"
    );
    expect(run.status).toBe(1);
    expect(run.said).toContain(say.notEmpty(occupied));
  });
});

describe("a directory that is as good as empty", () => {
  /**
   * The two directories somebody actually arrives with, judged by the built
   * bin: both used to be refused. `--dry-run`, because what is under test is
   * the judgement rather than the write — `cli/write.spec.ts` has that on a
   * real filesystem.
   */
  const dryRunInto = (dir: string): Promise<Run> =>
    bin(
      "agent",
      "generic",
      dir,
      "--name",
      "demo",
      "--description",
      "A demo agent",
      "--yes",
      "--dry-run"
    );

  it("takes one holding nothing but a repository", async () => {
    const dir = path.join(workspace, "git-init");
    await mkdir(path.join(dir, ".git"), { recursive: true });
    const run = await dryRunInto(dir);
    expect(run.status).toBe(0);
    expect(run.said).toContain(say.dryRun);
    expect(existsSync(path.join(dir, ".git"))).toBe(true);
  });

  it("takes one holding nothing but what the OS left behind", async () => {
    const dir = path.join(workspace, "finder");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".DS_Store"), "", "utf8");
    const run = await dryRunInto(dir);
    expect(run.status).toBe(0);
    // And it says nothing about what it tolerated: there is empty and not
    // empty, and this directory is empty.
    expect(run.said).not.toContain(".DS_Store");
    expect(existsSync(path.join(dir, ".DS_Store"))).toBe(true);
  });
});

describe("--dry-run", () => {
  it("prints what it would write, and writes nothing", async () => {
    const dir = path.join(workspace, "demo");
    const run = await bin(
      "agent",
      "generic",
      dir,
      "--name",
      "demo",
      "--description",
      "A demo agent",
      "--yes",
      "--dry-run"
    );
    expect(run.status).toBe(0);
    expect(run.said).toContain("src/agents/demo/");
    expect(run.said).toContain(say.dryRun);
    // The promise `--dry-run` makes is about the filesystem, which is the one
    // thing no pure spec can check.
    expect(existsSync(dir)).toBe(false);
  });
});
