/**
 * What a run would write, decided before anything is written.
 *
 * Pure: it takes the answers and a description of what is already at the
 * target, and answers with either the whole file set or one sentence saying why
 * not. The CLI reads the filesystem and does the writing; everything judged
 * here, a spec can reach with no process at all.
 */
import { projectFiles, type GeneratedFile } from "./agent/files.js";
import { blueprintOf } from "./agent/blueprints.js";
import { validateModelId, validateTenant } from "./agent/names.js";
import type { AgentSpec } from "./agent/spec.js";
import {
  describeTooLong,
  noDescription,
  notEmpty,
  unknownBlueprint
} from "./messages.js";

/** The longest one-line description worth putting on an agent card. */
export const DESCRIPTION_MAX = 200;

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

/** The plan for these answers, or the one sentence that stops it. */
export function plan(spec: AgentSpec, target: Target): Planned {
  const refuse = (problem: string): Planned => ({ ok: false, problem });

  if (blueprintOf(spec.blueprint) === undefined) {
    return refuse(unknownBlueprint(spec.blueprint));
  }
  const tenant = validateTenant(spec.tenant);
  if (tenant !== undefined) return refuse(tenant);
  const model = validateModelId(spec.modelId);
  if (model !== undefined) return refuse(model);
  if (spec.description.trim() === "") return refuse(noDescription());
  if (spec.description.length > DESCRIPTION_MAX) {
    return refuse(describeTooLong());
  }
  if (target.state === "occupied") return refuse(notEmpty(target.named));

  return { ok: true, plan: { spec, target, files: projectFiles(spec) } };
}
