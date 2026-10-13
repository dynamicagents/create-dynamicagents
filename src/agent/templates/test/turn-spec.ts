import type { AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./turn.spec.ts.tpl";

/**
 * `test/turn.spec.ts` — the whole A2A lifecycle on a scripted model.
 *
 * This is the spec that proves the project is wired: a gatekeeper-signed
 * request reaches the host, the host runs the pipeline, the pipeline runs the
 * step agent, the agent's turn answers, and the push callback the gatekeeper
 * would receive says so. Nothing here touches the network or a real model.
 */
export const turnSpec = (spec: AgentSpec): string =>
  render(source, {
    when: { subAgent: spec.subAgent },
    tokens: {
      TENANT: spec.tenant,
      SUBAGENT_NOTE: spec.subAgent
        ? ", its sub-agent is reachable under\n * the tool name its model is told"
        : ""
    }
  });
