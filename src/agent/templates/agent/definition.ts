import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./definition.ts.tpl";

/** `<dir>/definition.ts` — the tenant, its card and its Durable Object. */
export const definitionTs = (spec: AgentSpec, n: AgentNames): string =>
  render(source, {
    tokens: { CAMEL: n.camel, TENANT: spec.tenant, HOST_CLASS: n.hostClass }
  });
