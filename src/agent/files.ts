/**
 * Every file a generated project consists of, as data.
 *
 * Pure: a spec builds an `AgentSpec` and reads exactly what would be written,
 * with no filesystem and no process. `../cli/write.ts` is the only thing that
 * turns this into bytes on disk.
 *
 * The generator's three parts, from here: `./spec.ts` and `./names.ts` are the
 * vocabulary every layer reads; `./offer/` is the two menus the CLI puts in
 * front of somebody, which nothing below reads; and `./templates/` holds one
 * directory per blueprint, `generic/` and `claude-container/`, each with the
 * `files.ts` that writes it, beside `shared/`, what every blueprint reads. Every
 * spec in this directory is a spec on what `projectFiles` returns, which is why
 * they sit beside it.
 */
import type { AgentSpec } from "./spec";
import { claudeContainerFiles } from "./templates/claude-container/files";
import { genericFiles } from "./templates/generic/files";

/** One file to write, its path relative to the project root. */
export interface GeneratedFile {
  path: string;
  contents: string;
}

/** The whole project the spec's blueprint writes. */
export const projectFiles = (spec: AgentSpec): GeneratedFile[] =>
  spec.blueprint === "claude-container"
    ? claudeContainerFiles(spec)
    : genericFiles(spec);
