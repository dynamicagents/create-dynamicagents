import type { AgentNames } from "../../spec";
import { render } from "../render";
import source from "./children.ts.tpl";

/** `<dir>/children.ts` — the `general` sub-agent, bound to a class. */
export const childrenTs = (n: AgentNames): string =>
  render(source, {
    tokens: { CAMEL: n.camel, CHILD_CLASS: n.childClass }
  });
