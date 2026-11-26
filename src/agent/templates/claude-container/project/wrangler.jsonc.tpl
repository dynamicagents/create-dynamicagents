/**
 * One Worker, one agent.
 *
 * The agent is a **tenant** of this deployment, routed by `src/index.ts` on the
 * A2A `params.tenant`. That holds with one agent exactly as it would with
 * several, which is what makes adding a second one additive: another directory
 * under `src/agents/`, another block in each list below, and a new migration
 * tag. AGENTS.md carries the recipe.
 *
 * https://developers.cloudflare.com/workers/wrangler/configuration/
 */
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "claude-container",
  "main": "src/index.ts",
  // The date is the runtime: a workerd version *is* a release date, and this is
  // the one the pinned wrangler version installs. No `compatibility_flags`
  // beside it, and that is the date's doing: `nodejs_compat` is on by default
  // from 2026-08-04, so declaring it here would say nothing this date does not
  // already say.
  "compatibility_date": "$COMPATIBILITY_DATE",
  // The sandbox image's daemon, bundled from this project's own dependencies
  // before every deploy and dev run, so the object and the daemon in its
  // container speak one `agents` version. The `Dockerfile` copies it in;
  // `scripts/build-daemon.mjs` says why it is built rather than committed.
  "build": { "command": "node scripts/build-daemon.mjs" },

  // **One origin, and keep it.**
  //
  // Core derives the card's interface URL, its `jku` and the token audience it
  // verifies from `new URL(request.url).origin`. A second origin therefore
  // advertises a second audience, and a gatekeeper token minted for one does
  // not verify against the other: it could only ever serve a card nobody can
  // call.
  //
  // `workers_dev` is on so the first deploy is reachable at a URL you already
  // have. Moving to a domain of your own is one change: turn it off, declare
  // the route, deploy, and re-register the tenant with your gatekeeper against
  // the new origin.
  //
  //   "workers_dev": false,
  //   "routes": [{ "pattern": "agents.example.com", "custom_domain": true }]
  "workers_dev": true,

  // Headroom for git, which runs on this Worker's CPU rather than in the
  // container: `@cloudflare/computer/git` is isomorphic-git, so SHA-1 and
  // inflate are JavaScript here. A shallow clone of a 5,456-file monorepo was
  // measured at ~5.5 s wall-clock, most of it network, so the default 30 s is
  // not close to binding; this is for the repository an order of magnitude past
  // that, because a clone that dies at the limit costs a whole task.
  "limits": { "cpu_ms": 300000 },

  "observability": {
    "enabled": true,
    // Traces, not just logs: a span per RPC and alarm, which is where a Durable
    // Object that restarted shows (`agent_start`).
    "traces": {
      "enabled": true
    }
  },

  // --- required by core -----------------------------------------------------

  // The binding the agent's model goes through, via AI Gateway: Workers AI by
  // default, or a slug from AI Gateway's provider catalog over this same
  // binding (`src/config.ts`), so there is no model credential in this project. `remote: true` reflects reality and suppresses wrangler's
  // per-run warning; the test pool turns it off (vitest.config.ts) so no
  // connection is opened per test file.
  "ai": {
    "binding": "AI",
    "remote": true
  },

  // --- plugin-required bindings ---------------------------------------------
  // A plugin cannot add its own wrangler binding, which is the whole reason it
  // declares `requires`. Each of these is asserted when the agent starts, so a
  // missing one fails with a sentence naming the plugin rather than at the first
  // tool call.

  // The sandboxes' containers. Requires a PAID Workers plan.
  //
  // `class_name` is the Durable Object that *owns* the container, one-to-one:
  // a container belongs to exactly one object, which is what makes "one sandbox
  // per repository" a structural property rather than a convention.
  //
  // **The object starts its own container** (`scheduling_policy`), from the
  // image under `images.app` and at the size its config passes: see
  // `CLAUDE_CONTAINER_SANDBOX_INSTANCE` in `src/config.ts`. The policy is fixed
  // when an application is created: one made under another policy is deleted
  // before the deploy that moves it, never switched.
  //
  // **Nothing here caps how many run.** Running containers count against the
  // account's limits rather than a ceiling per entry, and that is what bounds
  // the fan-out: a writing or planning session works in a worktree of its own
  // while the parent keeps one, so N sessions at once want N+1 sandboxes. What
  // the width costs is the bill, because memory and disk are billed on
  // provisioned resources for as long as an instance runs, which is why a
  // settled task stops its container rather than waiting out the idle deadline.
  //
  // `observability` is per entry and not inherited from the Worker's: omitted,
  // an application keeps whatever it had. It is what carries the daemon's own
  // output.
  "containers": [
    {
      "class_name": "ClaudeContainerSandbox",
      "scheduling_policy": "durable_object",
      "images": {
        "app": {
          "dockerfile": "./Dockerfile",
          // **Pinned to the version the claude-code plugin verified**, and
          // `npm run check` fails when the two differ: the `Dockerfile`
          // carries why. The checksum is pinned because the build downloads
          // the tarball.
          "build_vars": {
            "CLAUDE_CODE_VERSION": "2.1.317",
            "GH_VERSION": "2.103.3",
            "GH_SHA256": "4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d"
          }
        }
      },
      "observability": { "logs": { "enabled": true } }
    }
  ],

  // Where a sandbox backs its checkouts up before every stop, scratchpads
  // included, which have no remote. A start on a new image drops the
  // container's snapshot, and this is what brings unpushed work back.
  // `DirectoryBackup` writes it through this binding alone, from the Worker
  // side, so no S3 credential exists anywhere; `@dynamicagents/plugins/sandbox`
  // owns the rest. A reclaimed sandbox deletes its own.
  "r2_buckets": [
    {
      "binding": "SANDBOX_BACKUPS",
      "bucket_name": "claude-container-sandbox-backups"
    }
  ],

  // $when browser
  // `@dynamicagents/plugins/browser`. Browser Rendering is a paid-plan binding,
  // and `remote: true` is required for it under `wrangler dev`.
  "browser": {
    "binding": "BROWSER",
    "remote": true
  },

  // The Dynamic Worker the browser tool runs the model's code in: a fresh one
  // per call, with no network access of its own. The plugin declares this
  // binding alongside `BROWSER`, so an agent that has one and not the other
  // fails at start rather than at its first browser call.
  //
  // Not inherited by a named environment, so each one needs its own entry.
  "worker_loaders": [{ "binding": "LOADER" }],

  // $end
  // --- the agent ------------------------------------------------------------

  // The agent's task host, which holds a caller's A2A tasks, and the step agent
  // its pipeline runs on, which holds the SQLite-backed Session: one continuous
  // history plus writable memory. Both are keyed by the verified caller, which
  // is what makes a task unreachable from any other caller by construction.
  //
  // A host's binding is named as its class: `hostBinding` in
  // src/agents/claude-container/host.ts names it, and the pipeline reaches the
  // host through it.
  //
  // The sub-agent classes (the writer, reviser, planner and discovery
  // sessions) are deliberately absent. Each is a facet created beneath its
  // agent, so it needs no binding and no `new_sqlite_classes` entry, only its
  // export from src/index.ts. They do need a test-only binding; see the comment
  // in vitest.config.ts.
  //
  // `ARTIFACTS` is **not optional**. Core files every sub-agent note on the
  // task's transcript and posts a link instead of the note, so an agent Durable
  // Object that starts without this binding throws `ArtifactsNotBoundError`
  // naming every part of the wiring, the route delegation at the top of `fetch`
  // in src/index.ts included. The class is core's own, re-exported unchanged
  // from src/index.ts, and one object serves the whole deployment.
  "durable_objects": {
    "bindings": [
      {
        "class_name": "ClaudeContainerHost",
        "name": "ClaudeContainerHost"
      },
      {
        "class_name": "ClaudeContainerAgent",
        "name": "ClaudeContainerAgent"
      },

      // Not an agent: the sandbox. One object per caller per repository,
      // driving the container whose disk is that checkout. Addressed by name,
      // never by the caller alone: see `sandboxName` in
      // `@dynamicagents/plugins/sandbox`.
      {
        "class_name": "ClaudeContainerSandbox",
        "name": "CLAUDE_CONTAINER_SANDBOX"
      },
      { "class_name": "Artifacts", "name": "ARTIFACTS" }
    ]
  },

  // **A tag is applied once, ever.** Anything appended to a tag already
  // deployed is simply never applied: the class is never created, and the
  // failure surfaces far from this file, at the first request to the agent or
  // at deploy with "New version of script does not export class 'X' which is
  // depended on by existing Durable Objects". Always add a new tag.
  //
  // Removing a class from the code reclaims nothing on its own either: every
  // object it created keeps its storage, unreachable and still billed.
  // `deleted_classes` in a new tag is the line that frees them, and it is
  // irreversible.
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": [
        "ClaudeContainerHost",
        "ClaudeContainerAgent",
        "ClaudeContainerSandbox",
        "Artifacts"
      ]
    }
  ],

  // The agent's pipeline: every task is an instance, its id the task's. The
  // name is derived from the tenant id rather than from this Worker, so moving
  // the agent into another Worker never renames it: a rename would abandon
  // every instance still running under the old name.
  "workflows": [
    {
      "name": "claude-container-workflow",
      "binding": "CLAUDE_CONTAINER_WORKFLOW",
      "class_name": "ClaudeContainerWorkflow"
    }
  ],

  // What an operator fills in; `.env.example` says what each one is. Declared
  // here because `secrets.required` is what drives type generation and
  // `wrangler dev`'s missing-secret warnings, so a name left here and unset is
  // typed as a definite string that is undefined at runtime.
  //
  // There is no model credential among them: the agent's own model goes
  // through the `AI` binding above. The Claude Code pool is read on the Worker
  // side only, by the sandbox egress that swaps it in for the placeholder a
  // container holds, so no credential enters a container.
  // Adding or dropping a pool entry is the same edit here and in
  // src/agents/claude-container/claude-code.ts.
  "secrets": {
    "required": [
      "A2A_SIGNING_KEY",
      "GATEKEEPER_ORIGINS",
      "CLAUDE_CODE_OAUTH_TOKEN_1",
      "CLAUDE_CODE_OAUTH_TOKEN_2",
      "CLAUDE_CODE_OAUTH_TOKEN_3"
    ]
  }
}
