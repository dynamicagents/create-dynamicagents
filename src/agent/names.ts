/**
 * The tenant id, what it has to satisfy, and everything derived from it.
 * Pure, so the spec needs no process.
 */
import type { AgentNames } from "./spec.js";

/**
 * A tenant id: lowercase words joined by single dashes.
 *
 * Narrow on purpose. The id becomes a directory name, a PascalCase class name,
 * a Durable Object binding, a Workflow name and an npm-safe project name, and
 * the intersection of what all of those accept is this.
 */
export const TENANT_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const TENANT_MIN = 2;
export const TENANT_MAX = 32;

/**
 * Tenant ids the generated code could not declare at all.
 *
 * `definition.ts` writes `export const <camelCase> = defineAgent(…)` and
 * `workflow.ts` writes the same name again as a class field, so a camelCase
 * form that is a reserved word is a project that does not parse, and
 * `constructor` is a name a class field is prohibited from having. Either one
 * is a syntax error in a file the dev never wrote, which is worse than a
 * refusal at the prompt.
 *
 * Only a one-word id can reach this: a reserved word has no capital in it.
 */
const LANGUAGE = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield"
]);

/**
 * Tenant ids whose camelCase form would collide with a member of core's
 * `TaskWorkflow` or `TaskHost`, which the generated pipeline and host declare
 * fields on. The collision is a type error in the generated project, far from
 * the prompt that caused it, so it is refused here instead.
 */
const RESERVED = new Set([
  "run",
  "pipeline",
  "step",
  "env",
  "ctx",
  "name",
  "copy",
  "manifest",
  "plugins",
  "soul"
]);

/**
 * Tenant ids whose derived names would land on an identifier a generated
 * module already has in scope, and the name each one would collide with.
 *
 * `a2a` is the one that reads like a joke and is not: `src/index.ts` imports
 * the agent's definition as `a2a` and then writes `const a2a =
 * createA2AWorker(…)`. `task` generates `class TaskHost extends TaskHost`.
 * Neither project parses, and neither is caught by the two sets above — these
 * are not words the language or core's classes reserve, they are names the
 * templates happen to import.
 *
 * So this is derived data rather than judgement. `names.spec.ts` parses every
 * module of a generated project with the TypeScript compiler, instantiates
 * each derived name against what that module already has in scope, and fails
 * if this map has fallen behind in either direction. A template that imports
 * something new is caught there rather than by the dev who typed the id.
 */
export const COLLIDES = new Map([
  ["a2a", "a2a"],
  ["agent-model", "agentModel"],
  ["create-a2-a-worker", "createA2AWorker"],
  ["define-agent", "defineAgent"],
  ["handle-artifact-route", "handleArtifactRoute"],
  ["host-manifest", "hostManifest"],
  ["manifest", "manifest"],
  ["plugins", "plugins"],
  ["step", "StepAgent"],
  ["task", "TaskHost"],
  ["turn-task", "turnTask"]
]);

/** A Workers AI model id, as the catalogue spells one. */
export const MODEL_ID_RE = /^@cf\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;

/** Why a tenant id was refused, or `undefined` when it is usable. */
export function validateTenant(input: string): string | undefined {
  const value = input.trim();
  if (value === "") return "Name it something.";
  if (value.length < TENANT_MIN || value.length > TENANT_MAX) {
    return `Between ${TENANT_MIN} and ${TENANT_MAX} characters.`;
  }
  if (!TENANT_RE.test(value)) {
    return "Lowercase letters, digits and single dashes, starting with a letter — like `support` or `release-notes`.";
  }
  const camel = camelCase(value);
  if (LANGUAGE.has(camel)) {
    return `\`${value}\` is a name JavaScript will not let the generated code declare. Pick another.`;
  }
  const collision = COLLIDES.get(value);
  if (collision !== undefined) {
    return `\`${value}\` would generate \`${collision}\`, which a generated module already has by that name. Pick another.`;
  }
  if (RESERVED.has(camel)) {
    return `\`${value}\` is a name the generated classes already use for something else. Pick another.`;
  }
  return undefined;
}

/** Why a model id was refused, or `undefined` when it looks like one. */
export function validateModelId(input: string): string | undefined {
  const value = input.trim();
  if (value === "") return "Paste a model id.";
  if (!MODEL_ID_RE.test(value)) {
    return "A Workers AI model id looks like `@cf/<org>/<model>`.";
  }
  return undefined;
}

const words = (tenant: string): string[] => tenant.split("-");

/** The name on the agent card, from the tenant id: `release-notes` → `Release Notes`. */
export const displayName = (tenant: string): string =>
  words(tenant)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const pascalCase = (tenant: string): string =>
  words(tenant)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

const camelCase = (tenant: string): string => {
  const [first, ...rest] = words(tenant);
  return (
    (first ?? "") +
    rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("")
  );
};

/**
 * Every name a generated project derives from its tenant id.
 *
 * A Durable Object binding is named as its class, which is what lets the host
 * name its own binding and a merge leave both alone.
 */
export function names(tenant: string): AgentNames {
  const pascal = pascalCase(tenant);
  const screaming = tenant.replace(/-/g, "_").toUpperCase();
  return {
    tenant,
    pascal,
    camel: camelCase(tenant),
    screaming,
    dir: `src/agents/${tenant}`,
    hostClass: `${pascal}Host`,
    workflowClass: `${pascal}Workflow`,
    agentClass: `${pascal}Agent`,
    childClass: `${pascal}Child`,
    workflowBinding: `${screaming}_WORKFLOW`,
    workflowName: `${tenant}-workflow`
  };
}
