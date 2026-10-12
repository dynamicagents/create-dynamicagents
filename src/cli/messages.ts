/** What `npm create dynamicagents` prints. Pure, so the spec needs no process. */
import { BLUEPRINTS } from "../agent/offer/blueprints";
import type { GeneratedFile } from "../agent/files";
// Types only: what this knows about a flag is what it says about one, and the
// keys it has to say it about.
import type { OPTIONS, Trouble } from "./args";
import { KINDS, type Kind } from "./kinds";
import { DEFAULT_MODEL_ID, MODELS_URL } from "../train";

export const WEBSITE = "https://dynamicagents.dev";

export const title = (version: string): string =>
  `Dynamic Agents · create-dynamicagents v${version}`;

export const question = "What would you like to build?";

/** The second question, once `agent` is the answer. */
export const whichAgent = "Which agent do you want to create?";

export const workInProgress = (kind: Kind): string =>
  `${kind.label} scaffolding is a work in progress. Follow updates at ${WEBSITE}`;

export const nothingBuilt = "Nothing was built.";

const width = Math.max(...KINDS.map((kind) => kind.value.length));
const choices = (): string =>
  KINDS.map((kind) => `  ${kind.value.padEnd(width)}  ${kind.hint}`).join("\n");

// --- the command line -------------------------------------------------------

/** How somebody reaches this, which is never the bin's own name. */
const COMMAND = "npm create dynamicagents@latest";

/**
 * Everybody hits this once: `npm create x agent --name y` keeps the flags for
 * npm, and the answers never arrive. So it is under every command this prints.
 */
const DASH_NOTE =
  "The `--` is npm's, not ours: without it npm keeps the flags for itself.";

/** One documented flag: `./args.ts` takes it, this prints it. */
export interface Flag {
  /** Its key in `OPTIONS`, which is what the parse answers with. */
  key: keyof typeof OPTIONS;
  /** How it is typed, as the help spells it. */
  spelled: string;
  /** What it answers, short enough to sit in one column inside the width. */
  answers: string;
}

/**
 * Every flag, in the order the help lists them.
 *
 * **A flag arrives whole**: the entry in `OPTIONS`, a line here, and a row in
 * `README.md`. `messages.spec.ts` holds all three together — a flag the parse
 * takes and nothing documents is as good as missing, and one documented and not
 * taken is an error on somebody's first run.
 */
export const FLAGS: readonly Flag[] = [
  {
    key: "name",
    spelled: "--name <tenant>",
    answers: "its tenant id, and every name derived from it"
  },
  {
    key: "description",
    spelled: "--description <line>",
    answers: "one line for its card, and its soul's first line"
  },
  {
    key: "dir",
    spelled: "--dir <path>",
    answers: "where to write it, if not a directory named for it"
  },
  {
    key: "model",
    spelled: "--model <id>",
    answers: "a Workers AI model id — see the catalogue"
  },
  {
    key: "subagent",
    spelled: "--no-subagent",
    answers: "leave out the sub-agent it hands research to"
  },
  {
    key: "browser",
    spelled: "--browser",
    answers: "install the browser plugin, its binding, its skill"
  },
  { key: "yes", spelled: "--yes", answers: "do not ask for confirmation" },
  {
    key: "dry-run",
    spelled: "--dry-run",
    answers: "print what would be written, and write nothing"
  },
  { key: "help", spelled: "--help, -h", answers: "what you are reading" },
  {
    key: "version",
    spelled: "--version, -v",
    answers: "the version that would run"
  }
];

const flagColumn = Math.max(...FLAGS.map((flag) => flag.spelled.length));

/** The flags, one per line, padded into a column inside the print width. */
const listed = (): string =>
  FLAGS.map(
    (flag) => `  ${flag.spelled.padEnd(flagColumn)}  ${flag.answers}`
  ).join("\n");

/**
 * The command with every answer on it, in the two lines a shell takes: one line
 * would be past the print width, and a `\` is how somebody copies it anyway.
 */
const example = (indent: string): string =>
  [
    `${indent}${COMMAND} agent ${BLUEPRINTS[0]!.value} <dir> -- \\`,
    `${indent}  --name <tenant> --description "<one line>" --yes`
  ].join("\n");

/**
 * `--help`.
 *
 * Printed plain, before anything else, so it reads the same in a terminal and
 * in a pipe: the two ways in, what it can build, and every flag — all of it
 * from the data the parse and the menus are built from, so there is nothing
 * here to fall behind.
 */
export const help = (version: string): string =>
  [
    title(version),
    "",
    "Create gates, leaders and agents on Dynamic Agents.",
    "",
    "Usage",
    `  ${COMMAND}`,
    "      Ask what to build, and ask for every answer.",
    "",
    example("  "),
    "      Answer up front. A usable answer is not asked for; one that",
    "      will not do is said where it was given.",
    "",
    "What it can build",
    choices(),
    "",
    "Flags",
    listed(),
    "",
    DASH_NOTE
  ].join("\n");

/** Without a TTY there is no menu, so every answer has to be an argument. */
export const noTerminal = (): string =>
  [
    "No terminal to ask in, so name what to build and answer for it:",
    "",
    choices(),
    "",
    example(""),
    "",
    "Flags",
    listed(),
    "",
    DASH_NOTE
  ].join("\n");

/**
 * A command line this could not read.
 *
 * It says what happened and nothing else: a mistyped flag in a terminal used to
 * be told there was no terminal, because the only usage message in the package
 * opened with that sentence.
 */
export const badArgument = (trouble: Trouble): string =>
  [
    "unknown" in trouble ? unknownFlags(trouble.unknown) : trouble.message,
    "",
    "Flags",
    listed(),
    "",
    DASH_NOTE
  ].join("\n");

const unknownFlags = (flags: readonly string[]): string => {
  const quoted = flags.map((flag) => `\`${flag}\``).join(", ");
  return flags.length === 1
    ? `${quoted} is not a flag this takes.`
    : `${quoted} are not flags this takes.`;
};

/**
 * A flag whose value will not do, where there is no terminal to ask in.
 *
 * The sentence is the prompt's own; what this adds is which flag carried the
 * value, because a log of a run that asked nothing has no prompt around it to
 * say so.
 */
export const badValue = (
  named: string,
  value: string,
  problem: string
): string =>
  [
    `\`${named} ${JSON.stringify(value)}\` will not do:`,
    "",
    `  ${problem}`
  ].join("\n");

export const unknownKind = (arg: string): string =>
  [`"${arg}" is not something to build. Name one of:`, "", choices()].join(
    "\n"
  );

export const unknownBlueprint = (arg: string): string =>
  [
    `"${arg}" is not an agent this can create. Name one of:`,
    "",
    BLUEPRINTS.map((b) => `  ${b.value}  ${b.hint}`).join("\n")
  ].join("\n");

// --- the questions ----------------------------------------------------------

export const askTenant = "What should the agent be called?";

export const tenantPlaceholder = "support";

/**
 * The id is a public identifier, so the prompt says so where it is typed rather
 * than in a document nobody reads first.
 */
export const tenantHelp =
  "Its tenant id, its directory and its class names. A gatekeeper registers against it, so it is awkward to change later.";

export const askDescription = "In one line, what does it do?";

export const descriptionPlaceholder =
  "Answers product questions from the handbook";

export const askSubAgent = "Give it a sub-agent to hand research to?";

export const askCapabilities =
  "Anything else it can do? (space to pick, enter for none)";

export const askModel = "Which model should it run on?";

export const defaultModelLabel = `The default — ${DEFAULT_MODEL_ID}`;

/** The catalogue, as a link where the terminal supports one. */
export const otherModelLabel = (hyperlinks: boolean): string =>
  `Another one — paste an id from ${link(MODELS_URL, MODELS_URL, hyperlinks)}`;

export const askModelId = "Paste the model id";

/**
 * A hyperlink a terminal can click, as OSC 8, or the bare URL where it cannot.
 *
 * Pure: whether the terminal supports it is read in `src/cli.ts` and passed in,
 * so a spec can assert both forms.
 */
export const link = (
  url: string,
  label: string,
  hyperlinks: boolean
): string =>
  hyperlinks ? `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007` : url;

export const confirmWrite = "Write it?";

// --- what it would write ----------------------------------------------------

/**
 * The tree, as the confirmation screen shows it: one line per directory, with
 * what is in it, rather than one line per file. A reader is deciding whether to
 * continue, not auditing.
 */
export function tree(dir: string, files: readonly GeneratedFile[]): string {
  const top = files
    .filter((file) => !file.path.includes("/"))
    .map((file) => file.path);
  const dirs = new Map<string, number>();
  for (const file of files) {
    const at = file.path.lastIndexOf("/");
    if (at === -1) continue;
    const parent = file.path.slice(0, at);
    dirs.set(parent, (dirs.get(parent) ?? 0) + 1);
  }
  const lines = [`${dir}/`];
  for (const [parent, count] of dirs) {
    lines.push(`  ${parent}/ — ${count === 1 ? "one file" : `${count} files`}`);
  }
  lines.push(`  ${top.join(" · ")}`);
  return lines.join("\n");
}

/** What to do once it is written, in the order the project's own checks need. */
export function nextSteps(dir: string, tenant: string): string {
  return [
    `cd ${dir}`,
    "npm run keygen            # one signing key — put it in .env",
    "npm run check             # types, format, lint, typecheck",
    "npm test                  # the suite, in real workerd",
    "npm run dev               # and when you are ready: npm run deploy",
    "",
    `Then write src/agents/${tenant}/soul.ts — it is the one part nobody else`,
    `can write for you — and register the tenant \`${tenant}\` with your`,
    "gatekeeper at https://<your-worker>/a2a",
    "",
    "README.md has the rest; AGENTS.md has the rules."
  ].join("\n");
}

export const installing = "Installing";

export const installed = "Installed";

export const wrote = (dir: string): string => `Wrote ${dir}`;

export const outroLine = (name: string): string =>
  `${name} is ready. Write its soul, then deploy it.`;

export const dryRun = "Nothing was written: this was a dry run.";

// --- the refusals -----------------------------------------------------------

export const notEmpty = (named: string): string =>
  `\`${named}\` already has something in it. Name a directory that does not exist yet, or an empty one.`;

/**
 * The target could not be read at all — no permission, or a file somewhere in
 * the path. Said here, before anything is written, because the alternative is
 * the same failure in the middle of writing.
 */
export const cannotRead = (named: string, problem: string): string =>
  [
    `\`${named}\` cannot be read, so there is no telling what is there:`,
    "",
    `  ${problem}`,
    "",
    "Name a directory that does not exist yet, or one you can write to."
  ].join("\n");

export const noDescription = (): string =>
  "Say in one line what the agent does: it goes on its card, and it is the first line of its soul.";

export const describeTooLong = (): string =>
  "One line, please — this goes on the agent's card. Say the rest in its soul once it exists.";

/**
 * A description reaches a TypeScript string literal, a markdown table cell and
 * the agent card, and a line break is wrong in all three — so it is refused
 * where it was typed rather than written out and left to fail.
 */
export const describeOneLine = (): string =>
  "One line means one line: no line breaks. It goes on the agent's card and into its source. Say the rest in its soul once it exists.";

/** An install that failed leaves a complete project, so say how to finish it. */
export const finishByHand = (dir: string, problem: string): string =>
  [
    problem,
    "",
    `The project is written. Finish it with:`,
    "",
    `  cd ${dir}`,
    "  npm install",
    "  npx wrangler types"
  ].join("\n");

/**
 * The last line after an install that failed, in place of {@link outroLine}.
 *
 * Not "ready": every next step needs the dependencies that did not arrive, and
 * a success outro under a failure is how somebody deploys a project that never
 * typechecked.
 */
export const notInstalled = (name: string): string =>
  `${name} is written, but its install did not finish. Run the commands above, then README.md has the rest.`;
