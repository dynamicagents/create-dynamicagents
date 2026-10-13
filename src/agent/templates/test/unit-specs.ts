import { MODEL_ID_RE } from "../../names";
import type { AgentSpec } from "../../spec";
import { render } from "../render";
import { namedFrom } from "../text";
import manifestSource from "./manifest.spec.ts.tpl";
import pluginsSource from "./plugins.spec.ts.tpl";
import soulSource from "./soul.spec.ts.tpl";
import tuningSource from "./tuning.spec.ts.tpl";

/**
 * The specs over the agent's own data: its soul, its card, its numbers and its
 * capabilities. No Worker, no model, no network — each one guards a rule the
 * next person editing that file would otherwise have to remember.
 *
 * Four files, and one module for them because they are one idea. Three of the
 * four vary in the tenant alone: every `import … from "@/agents/<tenant>/…"`
 * in them names a single specifier, and `namedFrom` never breaks one however
 * long the path, so those are written out in the templates. The exception is
 * `soul.spec.ts`, which imports two names or three and does break — see below.
 */

/** `test/soul.spec.ts` */
export const soulSpec = (spec: AgentSpec): string =>
  render(soulSource, {
    when: { subAgent: spec.subAgent },
    tokens: {
      /**
       * The one import here that is laid out rather than written: with the
       * sub-agent's `GENERAL_SOUL` it is three names, and prettier breaks it
       * one per line once a long tenant pushes the line past the print width.
       */
      SOUL_IMPORT: namedFrom(
        "import",
        ["MEMORY", "SOUL", ...(spec.subAgent ? ["GENERAL_SOUL"] : [])],
        `@/agents/${spec.tenant}/soul`
      ),
      NAME_LITERAL: JSON.stringify(spec.name),
      SUBAGENT_NOTE: spec.subAgent
        ? ", and each sub-agent in its tool's description"
        : ""
    }
  });

/** `test/manifest.spec.ts` */
export const manifestSpec = (spec: AgentSpec): string =>
  render(manifestSource, { tokens: { TENANT: spec.tenant } });

/** `test/tuning.spec.ts` */
export const tuningSpec = (spec: AgentSpec): string =>
  render(tuningSource, {
    tokens: {
      TENANT: spec.tenant,
      // The same regex the CLI validated the id with, read from `../../names.ts`
      // rather than written twice: a generated project asserting a rule this
      // one does not enforce is a project that fails its own suite.
      MODEL_ID_RE: MODEL_ID_RE.toString()
    }
  });

/** `test/plugins.spec.ts` */
export const pluginsSpec = (spec: AgentSpec): string =>
  render(pluginsSource, { tokens: { TENANT: spec.tenant } });
