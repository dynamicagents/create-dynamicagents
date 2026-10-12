/**
 * What a run would write, decided before anything is written.
 *
 * Pure: it takes the answers and a description of what is already at the
 * target, and answers with either the whole file set or one sentence saying why
 * not. The CLI reads the filesystem and does the writing; everything judged
 * here, a spec can reach with no process at all.
 *
 * It is the backstop rather than the first word on an answer: every rule it
 * applies is `./answers.ts`'s, and the flags and the prompts apply the same
 * judges as each answer arrives — so a refusal here is a spec on what reaches
 * `projectFiles`, not the sentence somebody is meant to read.
 */
import { projectFiles, type GeneratedFile } from "../agent/files";
import type { AgentSpec } from "../agent/spec";
import {
  asBlueprint,
  asDescription,
  asModelId,
  asTenant,
  type Judged
} from "./answers";
import { notEmpty } from "./messages";

/** What the CLI found at the path the project would go. */
export type TargetState =
  /** Nothing there. */
  | "free"
  /** A directory with no entries at all. */
  | "empty"
  /** A directory with something in it, or a file. */
  | "occupied";

export interface Target {
  /** The path as the user named it, for a message. */
  named: string;
  /** The absolute path the project goes. */
  dir: string;
  state: TargetState;
}

export interface Plan {
  spec: AgentSpec;
  target: Target;
  files: GeneratedFile[];
}

export type Planned = { ok: true; plan: Plan } | { ok: false; problem: string };

/**
 * Why the target will not do, or `undefined` when it will.
 *
 * Its own function so the CLI can run it the moment a directory is named: a
 * `--dir` that already has something in it is worth saying before the questions
 * rather than after every one of them.
 */
export const whyNotTarget = (target: Target): string | undefined =>
  target.state === "occupied" ? notEmpty(target.named) : undefined;

/** The plan for these answers, or the one sentence that stops it. */
export function plan(spec: AgentSpec, target: Target): Planned {
  const refuse = (problem: string): Planned => ({ ok: false, problem });

  // In the order a reader meets the questions, and each one the judge the flag
  // and the prompt already used.
  const answers: readonly Judged<unknown>[] = [
    asBlueprint(spec.blueprint),
    asTenant(spec.tenant),
    asModelId(spec.modelId),
    asDescription(spec.description)
  ];
  for (const answer of answers) {
    if ("problem" in answer) return refuse(answer.problem);
  }
  const problem = whyNotTarget(target);
  if (problem !== undefined) return refuse(problem);

  return { ok: true, plan: { spec, target, files: projectFiles(spec) } };
}
