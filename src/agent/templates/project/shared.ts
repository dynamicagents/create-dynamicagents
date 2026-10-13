/**
 * The two modules outside the agent's own directory that belong to no agent in
 * particular: the words every soul and every task shares, and how a model is
 * reached.
 *
 * **Both are constants, and that is deliberate.** Nothing in them names a
 * tenant, so every project this CLI generates has the same two files — which is
 * what makes a later merge of two generated projects have nothing to reconcile
 * here. Anything agent-specific goes in the agent's own directory instead; see
 * `../merge-notes.ts`.
 *
 * So both are `.tpl` files with no bindings at all, and this module is the two
 * names `../../files.ts` imports. The backticks still in `copy.ts.tpl` are the
 * *generated* project's own: its soul guidance is a template literal holding
 * markdown code spans, and holding that file as a file is what makes those
 * readable as the one level of nesting they are.
 */
import copyTsSource from "./copy.ts.tpl";
import modelTsSource from "./model.ts.tpl";

/** `src/copy.ts` — what this Worker's agent says that core refuses to write. */
export const copyTs = copyTsSource;

/** `src/model.ts` — the one model an agent or a sub-agent runs. */
export const modelTs = modelTsSource;
