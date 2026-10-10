/** What `npm create dynamicagents` prints. Pure, so the spec needs no process. */
import { BLUEPRINTS } from "./agent/blueprints.js";
import type { GeneratedFile } from "./agent/files.js";
import { KINDS, type Kind } from "./kinds.js";
import { DEFAULT_MODEL_ID, MODELS_URL } from "./train.js";

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

/** Without a TTY there is no menu, so every answer has to be an argument. */
export const noTerminal = (): string =>
  [
    "No terminal to ask in, so name what to build and answer for it:",
    "",
    choices(),
    "",
    `npm create dynamicagents@latest agent ${BLUEPRINTS[0]!.value} <dir> -- --name <tenant> --description "<one line>" --yes`,
    "",
    "Flags: --name, --description, --dir, --model, --no-subagent, --browser,",
    "       --yes, --dry-run.",
    "",
    "The `--` is npm's, not ours: without it npm keeps the flags for itself."
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
