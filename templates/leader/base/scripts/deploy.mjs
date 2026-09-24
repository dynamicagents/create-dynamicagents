#!/usr/bin/env node
/**
 * `npm run deploy` — the whole deploy, the first time and every time after.
 *
 * `wrangler deploy` on its own leaves three things to whoever runs it, and each
 * fails somewhere other than where it was missed:
 *
 * - **A Worker with this name may already exist in the account.** Wrangler
 *   replaces it without asking, and this project's `v1` migration is already
 *   applied there, so `LeaderAgent` would bind to *that* Worker's Durable
 *   Objects — its callers, its sessions, its workspaces. So a deploy refuses a
 *   Worker it cannot show is this project's: every version this script uploads
 *   carries `config.deployTag` from package.json, and a Worker whose recent
 *   versions carry none of them is somebody else's.
 * - **Wrangler provisions no Vectorize index**, so one this project binds is
 *   created here when it is missing.
 * - **A first deploy needs every `secrets.required` name in hand.** Wrangler
 *   cannot `secret put` into a Worker that does not exist yet, so `.env` goes up
 *   with the deploy itself — every time, which also makes `.env` the one place a
 *   secret is changed.
 *
 * Anything after `--` is handed to `wrangler deploy`. `--dry-run` skips all of
 * the above, since it uploads nothing; `--replace` deploys over a Worker that
 * is not this project's.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { experimental_readRawConfig } from "wrangler";

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const passthrough = args.filter((arg) => arg !== "--replace");

/** `npm run` puts `node_modules/.bin` on PATH; Windows needs a shell for its shims. */
function wrangler(argv, { capture = false } = {}) {
  const result = spawnSync("wrangler", argv, {
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`
  };
}

function stop(message, output = "") {
  if (output) console.error(output.trimEnd());
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (passthrough.includes("--dry-run")) {
  process.exit(wrangler(["deploy", ...passthrough]).status);
}

const { rawConfig } = experimental_readRawConfig({ config: "wrangler.jsonc" });
const name = rawConfig.name;

// --- Docker, before anything reaches the account -----------------------------

if ((rawConfig.containers ?? []).length > 0) {
  const docker = spawnSync("docker", ["info"], {
    stdio: "ignore",
    shell: process.platform === "win32"
  });
  if (docker.status !== 0) {
    stop(
      "Docker isn't running, and this deploy builds the workspace container " +
        "with it. Start Docker, then run `npm run deploy` again."
    );
  }
}

// --- logged in ---------------------------------------------------------------

// Checked first because the guard below captures wrangler's output, and a login
// prompt inside captured output is a deploy that hangs saying nothing.
if (/not authenticated/i.test(wrangler(["whoami"], { capture: true }).output)) {
  if (!wrangler(["login"]).ok) stop("Wrangler couldn't log in to Cloudflare.");
}

// --- this project's Worker, or nobody's ---------------------------------------

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
let deployTag = pkg.config?.deployTag;
if (!deployTag) {
  // A project made by `npm create dynamicagents` already has one. Anything
  // else gets one now, before its first upload, so every version it ever
  // uploads carries it.
  deployTag = randomUUID();
  pkg.config = { ...pkg.config, deployTag };
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
}

const versions = wrangler(["versions", "list", "--name", name, "--json"], {
  capture: true
});
if (versions.ok) {
  // The most recent versions only — wrangler lists no more. A run of uploads
  // that bypassed this script can push every tagged one out of the window;
  // `--replace` is the way past that, once you have checked.
  const ours = JSON.parse(versions.output).some(
    (version) => version.annotations?.["workers/tag"] === deployTag
  );
  if (!ours && !replace) {
    stop(
      `A Worker named "${name}" already exists in this Cloudflare account, and ` +
        "it isn't this project's. Deploying would replace it and take over its " +
        "Durable Objects. Change `name` in wrangler.jsonc — and the route with " +
        "it — or, if it really is this project, run `npm run deploy -- --replace`."
    );
  }
} else if (!versions.output.includes("[code: 10007]")) {
  // 10007 is "This Worker does not exist on your account": a first deploy.
  stop(
    `Couldn't check whether a Worker named "${name}" already exists.`,
    versions.output
  );
}

// --- the Vectorize indexes it binds --------------------------------------------

for (const { index_name: index } of rawConfig.vectorize ?? []) {
  const found = wrangler(["vectorize", "get", index], { capture: true });
  if (found.ok) continue;
  if (!found.output.includes("vectorize.index.not_found")) {
    stop(`Couldn't check the Vectorize index "${index}".`, found.output);
  }
  // Coupled to the recall plugin's embedding model — `RECALL` in the Claude
  // Code harness's `src/harness.ts`. An index of any other shape rejects every
  // vector written to it.
  const created = wrangler([
    "vectorize",
    "create",
    index,
    "--dimensions=1024",
    "--metric=cosine"
  ]);
  if (!created.ok) stop(`Couldn't create the Vectorize index "${index}".`);
}

// --- the deploy --------------------------------------------------------------

const secrets = existsSync(".env") ? ["--secrets-file", ".env"] : [];
process.exit(
  wrangler(["deploy", "--tag", deployTag, ...secrets, ...passthrough]).status
);
