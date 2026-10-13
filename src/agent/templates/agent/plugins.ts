import type { AgentSpec } from "../../spec";
import { render } from "../render";
import source from "./plugins.ts.tpl";

/**
 * `<dir>/plugins.ts` — the one file to edit to change what this agent can do.
 *
 * An uninstalled capability leaves no trace but the commented line: a plugin
 * declares the bindings it needs and core checks them when the agent starts, so
 * the comment is paired with the binding in `wrangler.jsonc` that would have to
 * arrive with it.
 *
 * The two bodies share nothing — an installed capability is a call, an
 * uninstalled one is a worked example in a comment — so they are
 * `$when browser` and `$when !browser` rather than one body with holes in it.
 * That is also why `./plugins.ts.tpl` declares `plugins` twice: exactly one of
 * the two survives a render, and nothing typechecks the template.
 */
export const pluginsTs = (spec: AgentSpec): string =>
  render(source, {
    when: {
      browser: spec.capabilities.includes("browser"),
      subAgent: spec.subAgent
    }
  });
