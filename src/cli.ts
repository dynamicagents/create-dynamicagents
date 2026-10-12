#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text
} from "@clack/prompts";
import { BLUEPRINTS } from "./agent/offer/blueprints.js";
import { CAPABILITIES } from "./agent/offer/capabilities.js";
import { displayName } from "./agent/names.js";
import type { AgentSpec, Capability } from "./agent/spec.js";
import {
  asBlueprint,
  asDescription,
  asKind,
  asModelId,
  asTenant,
  replyTo,
  whyNot,
  type Reply
} from "./cli/answers.js";
import { read } from "./cli/args.js";
import { installProject } from "./cli/install.js";
import { KINDS } from "./cli/kinds.js";
import * as say from "./cli/messages.js";
import {
  plan,
  whyNotTarget,
  type Target,
  type TargetState
} from "./cli/plan.js";
import { COMPATIBILITY_DATE, DEFAULT_MODEL_ID } from "./train.js";
import { writeProject } from "./cli/write.js";

/**
 * The bin: it reads its arguments, asks, writes, installs and prints. Every
 * string it says is in `./cli/messages.ts`, every rule it applies is in a pure
 * module in `./cli/` beside it — the command line is `./cli/args.ts`'s, what an
 * answer has to be and whether to ask again is `./cli/answers.ts`'s, and what it
 * would write is `./cli/plan.ts`'s — so all of that has a spec and none of it
 * needs a process.
 *
 * `./cli/` is this half: one run of the command, from the questions to the
 * install. `./agent/` is the other, and the only thing it is about is the
 * project this writes. `./train.ts` sits out here with this file because both
 * halves read it.
 */

// Read at runtime rather than imported: `package.json` sits outside `rootDir`.
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };

const argv = read(process.argv.slice(2));

/**
 * One line on stdout, waited for.
 *
 * `process.stdout.write` is asynchronous when stdout is a pipe, and
 * `process.exit()` does not wait for what is still queued — so printing and
 * exiting in the same breath cuts the output off at the pipe's buffer, in
 * exactly the case the two flags below are printed for.
 */
const print = (text: string): Promise<void> =>
  new Promise((resolve) => {
    // The callback also carries a write error — a closed pipe, say — and this
    // run has nothing to do about one but leave, which is what resolving does.
    process.stdout.write(`${text}\n`, () => resolve());
  });

/**
 * `--help` and `--version` answer and leave, before the frame opens and whether
 * or not there is a terminal to open one in.
 *
 * Plain on stdout, alone among everything this prints: both are read in a pipe
 * as often as in a terminal, and clack's bars and colour are noise in one.
 */
if (argv.want === "help") {
  await print(say.help(version));
  process.exit(0);
}
if (argv.want === "version") {
  await print(version);
  process.exit(0);
}

const interactive = process.stdin.isTTY === true;

/**
 * Terminals that take OSC 8 hyperlinks. Both variables are set by terminals
 * that do, and absent in a pipe — where an escape sequence would be noise in
 * somebody's log.
 */
const hyperlinks =
  interactive &&
  (process.env.TERM_PROGRAM !== undefined ||
    process.env.WT_SESSION !== undefined);

/** Stop. Nothing has been written when this is called. */
function stop(message: string): never {
  log.error(message);
  cancel(say.nothingBuilt);
  process.exit(1);
}

/**
 * A prompt the user escaped out of ends the run, like any other cancel.
 *
 * The return type subtracts the cancel symbol rather than naming the answer,
 * because every clack prompt answers `T | symbol` and inference would otherwise
 * carry that symbol into whatever is done with the answer.
 */
function answered<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel(say.nothingBuilt);
    process.exit(1);
  }
  return value as Exclude<T, symbol>;
}

/**
 * An answer, out of a decision `./cli/answers.ts` has already made: the value
 * the command line gave, or the question it takes to get a better one, or a
 * stop.
 *
 * The sentence is printed above the prompt rather than inside it, because
 * clack's own error line appears only once something has been typed — and what
 * arrived on the command line is already wrong.
 *
 * `NoInfer` keeps the prompt's cancel symbol out of the answer's type: clack
 * answers `T | symbol`, and without it `T` would widen to include the symbol at
 * every call site.
 */
async function settle<T>(
  reply: Reply<T>,
  ask: (initial?: string) => Promise<NoInfer<T> | symbol>
): Promise<T> {
  if (reply.kind === "use") return reply.value;
  if (reply.kind === "stop") stop(reply.problem);
  if (reply.problem !== undefined) log.warn(reply.problem);
  return answered(await ask(reply.initial));
}

/**
 * What was typed at a prompt, trimmed.
 *
 * Every judge trims what it judges, and an answer that arrived at a prompt
 * instead has to be treated the same way: a tenant id with a space around it is
 * a directory and a class name with a space in them, and a model id with one is
 * an id Workers AI does not have.
 */
const typed = (answer: string | symbol): string | symbol =>
  typeof answer === "string" ? answer.trim() : answer;

/** A flag, or the answer to a question, or its default where nobody can be asked. */
async function optional<T>(
  flag: T | undefined,
  ask: () => Promise<NoInfer<T> | symbol>,
  fallback: T
): Promise<T> {
  if (flag !== undefined) return flag;
  if (!interactive) return fallback;
  return answered(await ask());
}

intro(say.title(version));

if (argv.want === "trouble") stop(say.badArgument(argv.trouble));

const { flags, positionals } = argv;

/**
 * What is at `dir` already — the one filesystem read the plan needs.
 *
 * Only `ENOENT` means the path is free. Anything else is a path this run cannot
 * judge — no permission to look, a file where a directory would have to be —
 * and calling that "free" would turn it into a failure halfway through writing
 * instead of a sentence before anything is written.
 */
async function targetState(dir: string): Promise<TargetState> {
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) return "occupied";
    return (await readdir(dir)).length === 0 ? "empty" : "occupied";
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return "free";
  }
}

/**
 * Where the project would go, judged there and then.
 *
 * No question asks for a directory, so one that will not do is a stop rather
 * than a re-prompt — but it is a stop at the point the directory arrived, which
 * for `--dir` and for a third argument is before the first question.
 */
async function targetAt(named: string): Promise<Target> {
  const dir = path.resolve(process.cwd(), named);
  let state: TargetState;
  try {
    state = await targetState(dir);
  } catch (err) {
    stop(say.cannotRead(named, (err as Error).message));
  }
  const target: Target = { named, dir, state };
  const problem = whyNotTarget(target);
  if (problem !== undefined) stop(problem);
  return target;
}

/** The id prompt, which a `--model` that will not do arrives straight at. */
const askModelId = (initial?: string): Promise<string | symbol> =>
  text({
    message: say.askModelId,
    placeholder: DEFAULT_MODEL_ID,
    initialValue: initial,
    validate: whyNot(asModelId)
  });

async function chooseModel(): Promise<string | symbol> {
  const choice = answered(
    await select({
      message: say.askModel,
      options: [
        { value: "default", label: say.defaultModelLabel },
        { value: "other", label: say.otherModelLabel(hyperlinks) }
      ]
    })
  );
  if (choice === "default") return DEFAULT_MODEL_ID;
  return typed(await askModelId());
}

const kind = await settle(
  replyTo(positionals[0], asKind, { interactive }),
  () =>
    select({
      message: say.question,
      options: KINDS.map((entry) => ({
        value: entry,
        label: entry.label,
        hint: entry.hint
      }))
    })
);

if (!kind.ready) {
  // clack wraps a note with `trim: false`, so a line that breaks at a space
  // would start with it.
  note(kind.about, kind.label, { format: (line) => line.trimStart() });
  outro(say.workInProgress(kind));
  process.exit(0);
}

// --- an agent ---------------------------------------------------------------

// A directory that was named is judged here: first of everything about the
// agent, and before any question about it. Not before the question above it,
// because a directory is only where an *agent* goes — the kind that writes one
// is the one this is relevant to, and a kind that writes nothing yet has a note
// of its own to print instead.
const namedDir = flags.dir ?? positionals[2];
const judgedDir = namedDir === undefined ? undefined : await targetAt(namedDir);

const blueprint = await settle(
  replyTo(positionals[1], asBlueprint, { interactive }),
  () =>
    select({
      message: say.whichAgent,
      options: BLUEPRINTS.map((entry) => ({
        value: entry,
        label: entry.label,
        hint: entry.hint
      }))
    })
);

const tenant = await settle(
  replyTo(flags.name, asTenant, { interactive, named: "--name" }),
  async (initial) =>
    typed(
      await text({
        message: say.askTenant,
        placeholder: say.tenantPlaceholder,
        initialValue: initial,
        validate: whyNot(asTenant)
      })
    )
);

const description = await settle(
  replyTo(flags.description, asDescription, {
    interactive,
    named: "--description"
  }),
  async (initial) =>
    typed(
      await text({
        message: say.askDescription,
        placeholder: say.descriptionPlaceholder,
        initialValue: initial,
        validate: whyNot(asDescription)
      })
    )
);

const subAgent = await optional(
  flags.subagent,
  () => confirm({ message: say.askSubAgent, initialValue: true }),
  true
);

const capabilities = await optional<Capability[]>(
  flags.browser === true
    ? ["browser"]
    : flags.browser === false
      ? []
      : undefined,
  () =>
    multiselect<Capability>({
      message: say.askCapabilities,
      options: CAPABILITIES.map((capability) => ({
        value: capability.value,
        label: capability.label,
        hint: capability.hint
      })),
      // Nothing is pre-selected: a capability arrives because it was asked for,
      // never because it was the default.
      initialValues: [],
      required: false
    }),
  []
);

const modelId = await settle(
  replyTo(flags.model, asModelId, {
    interactive,
    named: "--model",
    fallback: DEFAULT_MODEL_ID
  }),
  // A `--model` that will not do means a model was chosen deliberately, so the
  // menu is skipped and the id itself is asked for, on what was typed.
  async (initial) =>
    initial === undefined ? chooseModel() : typed(await askModelId(initial))
);

const target = judgedDir ?? (await targetAt(tenant));

const spec: AgentSpec = {
  tenant,
  name: displayName(tenant),
  description,
  blueprint: blueprint.value,
  subAgent,
  capabilities,
  modelId,
  compatibilityDate: COMPATIBILITY_DATE
};

const planned = plan(spec, target);
if (!planned.ok) stop(planned.problem);

// No `format` here, unlike the notes above: the tree and the steps are laid
// out with indentation that means something, and clack's default keeps it.
note(say.tree(target.named, planned.plan.files), blueprint.label);

if (flags["dry-run"] === true) {
  outro(say.dryRun);
  process.exit(0);
}

if (flags.yes !== true && interactive) {
  const go = answered(await confirm({ message: say.confirmWrite }));
  if (!go) {
    cancel(say.nothingBuilt);
    process.exit(1);
  }
}

await writeProject(target.dir, planned.plan.files);
log.success(say.wrote(target.named));

const installing = spinner();
installing.start(say.installing);
try {
  await installProject(target.dir, (step) => installing.message(step));
  installing.stop(say.installed);
} catch (err) {
  // The project is written and complete; it is the install that failed. So the
  // run ends here, on the recovery rather than on the next steps: every one of
  // those needs the dependencies this did not install, and a success outro
  // under a failure is how somebody deploys a project that never typechecked.
  installing.stop(say.installing);
  log.error(say.finishByHand(target.named, (err as Error).message));
  cancel(say.notInstalled(spec.name));
  process.exit(1);
}

note(say.nextSteps(target.named, tenant), "Next");
outro(say.outroLine(spec.name));
