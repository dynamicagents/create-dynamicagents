import type { AgentSpec } from "../../spec";
import { render } from "../render";
import { stringProp } from "../text";
import source from "./host-manifest.ts.tpl";

/** `src/host-manifest.ts` — the stub card at the well-known path. */
export function hostManifestTs(spec: AgentSpec): string {
  const description =
    `Hosts a Dynamic Agent behind one A2A endpoint. This card describes the ` +
    `deployment rather than the agent — call GetExtendedAgentCard with a tenant ` +
    `id to fetch an agent's own card. Tenants: \`${spec.tenant}\` (${spec.description.replace(/\.$/, "")}).`;

  return render(source, {
    tokens: {
      // A block, and with its trailing comma: this description is long enough
      // to break after the colon in every project, and `stringProp` is what
      // knows where. See `../agent/manifest.ts` on the comma.
      CARD_IDENTITY: `${[
        stringProp("name", spec.tenant),
        stringProp("description", description)
      ].join(",\n")},`
    }
  });
}
