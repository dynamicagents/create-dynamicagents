import type { AgentSpec } from "../../spec";
import { render } from "../render";
import { quoted } from "../text";
import source from "./soul.ts.tpl";

/**
 * `<dir>/soul.ts` — who the agent is.
 *
 * Seeded from the one line the CLI asked for, and said out loud to be a
 * starting point: core ships no prompt copy at all, deliberately, so that no
 * run ever executes under an identity nobody chose. Generating a first draft
 * does not change that — it just means the draft is the dev's to replace.
 *
 * Every rule but the first is the same in every project, so the soul is read
 * here rather than composed: the file *is* the copy. The first entry is the one
 * thing nobody else can write, and it is the one token.
 */
export function soulTs(spec: AgentSpec): string {
  return render(source, {
    when: { subAgent: spec.subAgent },
    tokens: {
      /**
       * The identity line, as a complete quoted literal rather than as bare
       * text in a hand-written `"…"`. A description may hold a double quote —
       * see the `LINE_BREAK` comment in `../../../cli/answers.ts` — and
       * `quoted()` is what picks the quote style and the escaping for it. The
       * two spaces of indentation are the file's, not this helper's.
       */
      IDENTITY_LINE: quoted(`You are ${spec.name}. ${spec.description}`),
      // Mid-sentence, and across a line break inside a block comment, which is
      // why it is a phrase and not a region.
      SUBAGENT_NOTE: spec.subAgent
        ? ", and each sub-agent in its\n * tool's description"
        : ""
    }
  });
}
