/**
 * Taking a generated agent into another Worker, as data.
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
 * - every file outside it is tenant-independent and identical in every
 *   generated project, so a merge has nothing to reconcile there;
 * - every class, binding and workflow name derives from the tenant id, so two
 *   agents cannot collide and a merge renames nothing.
 *
 * The recipe lives here as data because it is rendered into the generated
 * AGENTS.md — the file the coding agent doing the merge will read — and because
 * a spec can then hold it to naming every wiring point the templates write. A
 * new wiring point fails `merge-notes.spec.ts` until it is mentioned here.
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
    what: "Copy the whole directory across. Nothing in it reaches outside itself except `@/copy` and `@/model`, which the other project already has."
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
    path: "package.json",
    what: "Union the dependencies. Both projects were generated against the same train, so the ranges agree unless one has been bumped."
  },
  {
    path: ".env.example",
    what: "Union the secrets, and add any the arriving agent's plugins require to `secrets.required` in wrangler.jsonc."
  },
  {
    path: "test/",
    what: "Copy its specs and its `test/worker.ts` classes, and add their test-only bindings to `vitest.config.ts`."
  },
  {
    path: "vitest.config.ts",
    what: "Add the arriving agent's test-only Durable Object and workflow bindings."
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
