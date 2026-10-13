import type { AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./env.example.tpl";

/**
 * `.env.example` — the two secrets, and why there is no third.
 *
 * A bare `.tpl`, which prettier has no parser for and skips — the same thing it
 * does with the `.env.example` a generated project holds, so nothing is lost.
 */
export const envExample = (spec: AgentSpec): string =>
  render(source, { tokens: { TENANT: spec.tenant } });
