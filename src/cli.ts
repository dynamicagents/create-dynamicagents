#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  cancel,
  intro,
  isCancel,
  log,
  note,
  outro,
  select
} from "@clack/prompts";
import { KINDS, kindOf, type Kind } from "./kinds.js";
import {
  noTerminal,
  nothingBuilt,
  question,
  title,
  unknownKind,
  workInProgress
} from "./messages.js";

// Read at runtime rather than imported: `package.json` sits outside `rootDir`.
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };

async function choose(arg: string | undefined): Promise<Kind | undefined> {
  if (arg !== undefined) {
    const kind = kindOf(arg);
    if (kind === undefined) log.error(unknownKind(arg));
    return kind;
  }
  if (!process.stdin.isTTY) {
    log.warn(noTerminal());
    return undefined;
  }
  const picked = await select({
    message: question,
    options: KINDS.map((kind) => ({
      value: kind,
      label: kind.label,
      hint: kind.hint
    }))
  });
  return isCancel(picked) ? undefined : picked;
}

intro(title(version));
const kind = await choose(process.argv[2]);
if (kind === undefined) {
  cancel(nothingBuilt);
  process.exitCode = 1;
} else {
  // clack wraps a note with `trim: false`, so a line that breaks at a space
  // would start with it.
  note(kind.about, kind.label, { format: (line) => line.trimStart() });
  outro(workInProgress(kind));
}
