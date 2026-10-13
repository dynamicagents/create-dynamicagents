import { MODELS_URL } from "../../../train";
import type { AgentSpec } from "../../spec";
import { render } from "../render";
import { quoted } from "../text";
import source from "./tuning.ts.tpl";

/**
 * `<dir>/tuning.ts` — the numbers.
 *
 * In the agent's own directory rather than a shared config file, and that is a
 * merge decision: everything specific to this agent is in one folder, so taking
 * it into another Worker later is a folder move plus wiring, with no shared
 * file to reconcile.
 */
export const tuningTs = (spec: AgentSpec): string =>
  render(source, {
    tokens: {
      // A pin, read where it is written rather than copied into the template.
      MODELS_URL,
      // Both model ids, as complete quoted literals: a model id comes from the
      // catalogue or from `--model`, so `quoted()` picks the quoting for it.
      MODEL_ID: quoted(spec.modelId),
      WHY_TIGHT: spec.subAgent
        ? ": a delegating agent accumulates sub-agent results fast"
        : ": a long history is re-sent on every call of the turn"
    }
  });
