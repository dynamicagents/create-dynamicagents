#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
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
import { BLUEPRINTS, blueprintOf, type Blueprint } from "./agent/blueprints.js";
import { CAPABILITIES } from "./agent/capabilities.js";
import { displayName, validateModelId, validateTenant } from "./agent/names.js";
import type { AgentSpec, Capability } from "./agent/spec.js";
import { installProject } from "./install.js";
import { KINDS, kindOf, type Kind } from "./kinds.js";
import * as say from "./messages.js";
import { plan, type Target, type TargetState } from "./plan.js";
import { COMPATIBILITY_DATE, DEFAULT_MODEL_ID } from "./train.js";
import { writeProject } from "./write.js";

/**
 * The bin: it reads its arguments, asks, writes, installs and prints. Every
 * string it says is in `./messages.ts`, every rule it applies is in a pure
 * module beside it, and what it would write is `./plan.ts`'s — so all of that
 * has a spec and none of it needs a process.
 */

// Read at runtime rather than imported: `package.json` sits outside `rootDir`.
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };

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
 * A flag, or the answer to a question, or — with no terminal to ask in — a stop.
 *
 * `NoInfer` keeps the prompt's cancel symbol out of the answer's type: clack
 * answers `T | symbol`, and without it `T` would widen to include the symbol at
 * every call site.
 */
async function required<T>(
  flag: T | undefined,
  ask: () => Promise<NoInfer<T> | symbol>
): Promise<T> {
  if (flag !== undefined) return flag;
  if (!interactive) stop(say.noTerminal());
  return answered(await ask());
}

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

let flags: {
  name?: string;
  description?: string;
  dir?: string;
  model?: string;
  subagent?: boolean;
  browser?: boolean;
  yes?: boolean;
  "dry-run"?: boolean;
};
let positionals: string[];
try {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      name: { type: "string" },
      description: { type: "string" },
      dir: { type: "string" },
      model: { type: "string" },
      // `allowNegative` is what makes `--no-subagent` an answer rather than an
      // unknown flag, and leaving these without a default is what tells "not
      // given" from "given false".
      subagent: { type: "boolean" },
      browser: { type: "boolean" },
      yes: { type: "boolean" },
      "dry-run": { type: "boolean" }
    },
    allowNegative: true
  });
  flags = parsed.values;
  positionals = parsed.positionals;
} catch (err) {
  intro(say.title(version));
  stop(`${(err as Error).message}\n\n${say.noTerminal()}`);
}

async function chooseKind(arg: string | undefined): Promise<Kind> {
  const named = arg === undefined ? undefined : kindOf(arg);
  if (arg !== undefined && named === undefined) stop(say.unknownKind(arg));
  return required(named, () =>
    select({
      message: say.question,
      options: KINDS.map((kind) => ({
        value: kind,
        label: kind.label,
        hint: kind.hint
      }))
    })
  );
}

async function chooseBlueprint(arg: string | undefined): Promise<Blueprint> {
  const named = arg === undefined ? undefined : blueprintOf(arg);
  if (arg !== undefined && named === undefined) stop(say.unknownBlueprint(arg));
  return required(named, () =>
    select({
      message: say.whichAgent,
      options: BLUEPRINTS.map((entry) => ({
        value: entry,
        label: entry.label,
        hint: entry.hint
      }))
    })
  );
}

/** What is at `dir` already — the one filesystem read the plan needs. */
async function targetState(dir: string): Promise<TargetState> {
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) return "occupied";
    return (await readdir(dir)).length === 0 ? "empty" : "occupied";
  } catch {
    return "free";
  }
}

async function chooseModel(): Promise<string> {
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
  return answered(
    await text({
      message: say.askModelId,
      placeholder: DEFAULT_MODEL_ID,
      validate: (value) => validateModelId(value ?? "")
    })
  );
}

intro(say.title(version));

const kind = await chooseKind(positionals[0]);
if (!kind.ready) {
  // clack wraps a note with `trim: false`, so a line that breaks at a space
  // would start with it.
  note(kind.about, kind.label, { format: (line) => line.trimStart() });
  outro(say.workInProgress(kind));
  process.exit(0);
}

// --- an agent ---------------------------------------------------------------

const blueprint = await chooseBlueprint(positionals[1]);

const tenant = (
  await required(flags.name, () =>
    text({
      message: say.askTenant,
      placeholder: say.tenantPlaceholder,
      validate: (value) => validateTenant(value ?? "")
    })
  )
).trim();

const description = (
  await required(flags.description, () =>
    text({
      message: say.askDescription,
      placeholder: say.descriptionPlaceholder
    })
  )
).trim();

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

// Trimmed here, like the two answers above: every validator trims before it
// judges, so an id with spaces around it passes the plan, and writing it
// untrimmed into `tuning.ts` is a model id Workers AI does not have.
const modelId = (
  await optional(flags.model, () => chooseModel(), DEFAULT_MODEL_ID)
).trim();

const named = flags.dir ?? positionals[2] ?? tenant;
const dir = path.resolve(process.cwd(), named);
const target: Target = { named, dir, state: await targetState(dir) };

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
