import type { AgentPlugin } from "@dynamicagents/core";
// $when browser
import { browser } from "@dynamicagents/plugins/browser";
// $end

/**
 * The one file you edit to add or remove a capability for this agent.
 *
 * Delete a line and that module leaves the bundle entirely. Nothing in core
 * imports a plugin, and `@dynamicagents/plugins` has no root barrel — the bare
 * specifier does not resolve — so what the agent carries is what is listed
 * here.
 *
 * A plugin declares the bindings and secrets it needs, and core checks them
 * when the agent starts: an installed plugin whose binding is missing from
 * `wrangler.jsonc` fails with a sentence naming the plugin, rather than at the
 * first tool call inside a request someone is waiting on. So a line here and a
 * binding there arrive together.
 *
 * What the model is told about a capability comes from the plugin itself, not
 * from `./soul.ts`: removing a line removes its advice with it.
 * $when subAgent
 *
 * The agent and its `general` sub-agent install the same list. Files are
 * Think's own workspace, in each object's SQLite, so there is nothing to
 * install for them.
 * $end
 */
// $when browser
export const plugins = (env: Env): AgentPlugin<Env>[] => [
  // Read web pages. Needs the `BROWSER` binding in wrangler.jsonc.
  browser({ binding: env.BROWSER })
];
// $end
// $when !browser
export const plugins = (_env: Env): AgentPlugin<Env>[] => [
  // Nothing installed yet. Each capability is one line here plus its binding
  // in wrangler.jsonc plus a skill on the card in ./manifest.ts — for example:
  //
  //   import { browser } from "@dynamicagents/plugins/browser";
  //   browser({ binding: env.BROWSER })
  //
  // The parameter is `_env` only because nothing reads it yet; the first
  // plugin that needs a binding takes the underscore off.
];
// $end
