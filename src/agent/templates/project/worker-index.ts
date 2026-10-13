import type { AgentNames, AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./index.ts.tpl";

/**
 * `src/index.ts` — the Worker entry: the exports, the mount, the routes.
 *
 * Every `export … from` here names one class, and `namedFrom` never breaks a
 * single specifier however long the path — so these are written out in
 * `./index.ts.tpl` rather than laid out, and the tenant in each path is a
 * token.
 */
export const indexTs = (spec: AgentSpec, n: AgentNames): string =>
  render(source, {
    when: { subAgent: spec.subAgent },
    tokens: {
      TENANT: spec.tenant,
      CAMEL: n.camel,
      HOST_CLASS: n.hostClass,
      WORKFLOW_CLASS: n.workflowClass,
      AGENT_CLASS: n.agentClass,
      CHILD_CLASS: n.childClass
    }
  });
