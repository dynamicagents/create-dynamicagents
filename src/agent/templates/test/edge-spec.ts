import type { AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./edge.spec.ts.tpl";

/**
 * `test/edge.spec.ts` — the zero-trust edge, with no model involved.
 *
 * It drives the **production** Worker (`src/index.ts`), not the scripted one:
 * nothing here reaches a Durable Object, so there is nothing to stub.
 */
export const edgeSpec = (spec: AgentSpec): string =>
  render(source, {
    tokens: {
      TENANT: spec.tenant,
      // `JSON.stringify` rather than `quoted()`, which is what this template
      // has always written: the two differ only for a name holding a double
      // quote, and changing it would change what a user receives.
      NAME_LITERAL: JSON.stringify(spec.name)
    }
  });
