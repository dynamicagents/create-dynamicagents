/** What `npm create dynamicagents` prints. Pure, so the spec needs no process. */
import { KINDS, type Kind } from "./kinds.js";

export const WEBSITE = "https://dynamicagents.dev";

export const title = (version: string): string =>
  `Dynamic Agents · create-dynamicagents v${version}`;

export const question = "What would you like to build?";

export const workInProgress = (kind: Kind): string =>
  `${kind.label} scaffolding is a work in progress. Follow updates at ${WEBSITE}`;

export const nothingBuilt = "Nothing was built.";

const width = Math.max(...KINDS.map((kind) => kind.value.length));
const choices = (): string =>
  KINDS.map((kind) => `  ${kind.value.padEnd(width)}  ${kind.hint}`).join("\n");

/** Without a TTY there is no menu, so the kind has to be an argument. */
export const noTerminal = (): string =>
  [
    "No terminal to ask in, so name what to build:",
    "",
    choices(),
    "",
    "npm create dynamicagents@latest <kind>"
  ].join("\n");

export const unknownKind = (arg: string): string =>
  [`"${arg}" is not something to build. Name one of:`, "", choices()].join(
    "\n"
  );
