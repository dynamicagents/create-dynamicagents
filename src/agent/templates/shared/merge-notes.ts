/**
 * Taking a generated agent into another Worker, as data.
 *
 * In `templates/shared/` beside `text.ts`: this folder is what a template
 * reads, and each blueprint's own directory is what a template writes.
 * `generic/project/agents-md.ts` is the one caller, which is where this is
 * rendered for the person — or the coding agent — doing the merge.
 *
 * The creator makes one agent per Worker, and that is the isolation it is for:
 * one wrangler config, one bundle, one deployment, nothing shared with anybody
 * else's agent. A dev who later wants several in one Worker should find that
 * easy rather than a refactor, and easy is a property of the **layout** — so
 * what makes it easy is decided when the project is generated, not when the
 * merge happens:
 *
 * - the agent's own directory holds everything specific to it, the numbers
 *   included, so a merge moves one folder;
 * - outside it, the support files are tenant-independent and byte-identical in
 *   every project of one blueprint: the toolchain config, `src/copy.ts`,
 *   `src/model.ts`, the test tsconfig. Across blueprints they are not, and a
 *   claude-container agent reaches past its directory besides, so what it
 *   brings into a generic project is {@link claudeContainerSteps}, held to
 *   the projects the same way. What is left is wiring, and short: the Worker
 *   entry, the deployment
 *   card, the wrangler and vitest configs, the dependency list, the secrets,
 *   the suite and the two guides. Each one of them is a step below, and
 *   `merge-notes.spec.ts` derives that set rather than trusting this list;
 * - every class, binding and workflow name derives from the tenant id, so two
 *   agents cannot collide and a merge renames nothing.
 *
 * The recipe lives here as data because it is rendered into the generated
 * AGENTS.md — the file the coding agent doing the merge will read — and because
 * a spec can then hold it to naming every wiring point the templates write.
 * That spec generates projects that differ and compares them: a file outside
 * the agent's directory whose contents depend on the tenant id or on an answer
 * is a wiring point by definition, and it fails until a step here names it.
 */

/** One step of the merge, and what it touches. */
export interface MergeStep {
  /** The file or directory the step is about, relative to the project root. */
  path: string;
  /** What to do with it, as one sentence. */
  what: string;
}

export const mergeSteps = (dir: string): readonly MergeStep[] => [
  {
    path: `${dir}/`,
    what: "Copy the whole directory across. Nothing in a generic agent's reaches outside itself except `@/copy` and `@/model`, which this project already has. A claude-container agent reaches further: the table after this one is what it brings."
  },
  {
    path: "src/index.ts",
    what: "Add the `definition` import, the class exports, and the agent to the `agents` array of `createA2AWorker`."
  },
  {
    path: "src/host-manifest.ts",
    what: "Name the arriving tenant in the description. It is the only place the deployment's card says what is here."
  },
  {
    path: "wrangler.jsonc",
    what: "Add its two Durable Object bindings and its `workflows` entry, and create its classes in a **new** migration tag — never one already deployed. `Artifacts` is already there: do not create it twice."
  },
  {
    path: "wrangler.jsonc",
    what: "Then copy every capability binding the arriving config declares — `browser` is the one this creator writes — with its settings as they stand. A plugin declares the bindings it needs and core checks them when the agent starts, so `plugins.ts` without its binding is an agent that throws on its first request."
  },
  {
    path: "package.json",
    what: "Union the dependencies. Both projects were generated against the same train, so the ranges agree unless one has been bumped."
  },
  {
    path: ".env.example",
    what: "Union the secrets, and add any the arriving agent's plugins require to `secrets.required` in wrangler.jsonc."
  },
  {
    path: "test/",
    what: "Rename the arriving specs as they come across. Every generated project calls them `turn.spec.ts`, `edge.spec.ts`, `soul.spec.ts` and so on, so copying them in overwrites the suite that is already here — `turn.<tenant>.spec.ts`, or a directory per tenant, either reads fine."
  },
  {
    path: "test/worker.ts",
    what: "Merge rather than copy: the suite runs one test Worker. Add the arriving agent's `Test*` classes, its three bindings to `TestEnv`, its `manifest` import under an alias — both projects import that name — and a second `defineAgent({ tenant, manifest, agent })` to the `agents` array. Without that last one its turn specs call a tenant the test Worker does not serve."
  },
  {
    path: "vitest.config.ts",
    what: "Add the arriving agent's test-only Durable Object and workflow bindings."
  },
  {
    path: "README.md",
    what: "It was written for one agent: add the arriving tenant to the registration table and to the list of files worth editing, and stop calling the deployment one agent. A reader who believes the old sentence will register one tenant and wonder where the other went."
  },
  {
    path: "AGENTS.md",
    what: "The same, starting with the heading and the tenant id in its first lines — and keep this recipe in it, because the next merge is read from there."
  }
];

/**
 * What a claude-container agent brings into a generic project, beside
 * {@link mergeSteps}: the modules outside its directory that it imports or its
 * image is built from, and what its own wiring holds that a generic agent's
 * does not. `merge-notes.spec.ts` derives this set too, from every file of a
 * claude-container project that a generic one lacks or spells differently.
 */
export const claudeContainerSteps: readonly MergeStep[] = [
  {
    path: "src/config.ts",
    what: "Copy it across: the agent's model, its sessions' model and limits and its sandbox's size live here rather than in its directory, and its modules import `@/config`."
  },
  {
    path: "src/workspace/",
    what: "Copy it across whole: the sandbox, the scratchpad and the author its commits carry, which the agent imports as `@/workspace/*`."
  },
  {
    path: "src/sandbox-daemon.ts",
    what: "Copy it across: it is what `scripts/build-daemon.mjs` bundles into the image."
  },
  {
    path: "src/copy.ts",
    what: "Replace the generic one with it: it exports everything the generic one does, and what the agent's soul imports besides."
  },
  {
    path: "src/model.ts",
    what: "Replace the generic one with it: it exports everything the generic one does, and reaches AI Gateway's catalog besides, which `src/config.ts` may name."
  },
  {
    path: "Dockerfile",
    what: "Copy it across: the sandbox's image is built from it."
  },
  {
    path: ".dockerignore",
    what: "Copy it across beside the `Dockerfile`."
  },
  {
    path: "scripts/",
    what: "Copy it across: `build-daemon.mjs` bundles the daemon before every deploy, and `verify-container-env.mjs` is the Claude Code pin check."
  },
  {
    path: "wrangler.jsonc",
    what: "Take its `build` command, its `limits`, its `containers` entry with the `CLAUDE_CODE_VERSION` build var, its sandbox's Durable Object binding with that class in the **new** migration tag, its `SANDBOX_BACKUPS` bucket, which `npx wrangler r2 bucket create` makes before the first deploy, and its `CLAUDE_CODE_OAUTH_TOKEN_*` entries under `secrets.required`."
  },
  {
    path: "package.json",
    what: "Take its `verify:container-env` and `pretest` scripts, and end `check` with the first as its own `check` does."
  },
  {
    path: ".env.example",
    what: "Take its `CLAUDE_CODE_OAUTH_TOKEN_*` entries and what it says about them: a session runs on one of those subscriptions."
  },
  {
    path: ".gitignore",
    what: "Add `/container/`, where the daemon bundle is built."
  },
  {
    path: "vitest.config.ts",
    what: "Take the placeholder `CLAUDE_CODE_OAUTH_TOKEN_*` values it sets for the suite, beside its bindings."
  }
];

/**
 * What nothing in the code hints at, so the merge recipe has to say it.
 *
 * A Durable Object belongs to the script that declares its class: an agent
 * merged into another Worker is a new namespace there, and the objects it had
 * stay in the old script, reachable only by redeploying it.
 */
export const MERGE_CAVEAT =
  "A merge does not move state. Every task, conversation and memory the agent had belongs to the Worker it was deployed as; in the merged Worker it starts empty. Finish or drain what is running before you cut over, and keep the old script deployed until you have.";
