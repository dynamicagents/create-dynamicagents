import type { AgentNames, AgentSpec } from "../../../spec";
import { hasGeneral } from "../../../spec";
import { render } from "../../shared/render";
import source from "./agent.ts.tpl";

/** `<dir>/agent.ts` — core's `StepAgent`: what this agent actually is. */
export const agentTs = (spec: AgentSpec, n: AgentNames): string =>
  render(source, {
    when: { general: hasGeneral(spec) },
    tokens: {
      NAME: spec.name,
      AGENT_CLASS: n.agentClass,
      CAMEL: n.camel,
      CHILD_CLASS: n.childClass,
      // Mid-sentence in the class's doc comment, listing the files that are
      // actually this agent — so a phrase rather than a region, which would
      // need a line of its own.
      SOUL_FILES: hasGeneral(spec) ? ", `./children.ts`" : ""
    }
  });
