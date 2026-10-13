import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./agent.ts.tpl";

/** `<dir>/agent.ts` — core's `StepAgent`: what this agent actually is. */
export const agentTs = (spec: AgentSpec, n: AgentNames): string =>
  render(source, {
    when: { subAgent: spec.subAgent },
    tokens: {
      NAME: spec.name,
      AGENT_CLASS: n.agentClass,
      CAMEL: n.camel,
      CHILD_CLASS: n.childClass,
      // Mid-sentence in the class's doc comment, listing the files that are
      // actually this agent — so a phrase rather than a region, which would
      // need a line of its own.
      SOUL_FILES: spec.subAgent ? ", `./children.ts`" : ""
    }
  });
