import { describe, expect, it } from "vitest";
import { ASK_GUIDANCE } from "@/copy";
// $block SOUL_IMPORT

/**
 * The rules the soul has to keep, as it is rewritten.
 *
 * It **will** be rewritten — it is the one file core refuses to ship and the
 * first one to edit. These are the two things easy to break while doing it.
 */

describe("SOUL", () => {
  it("says who the agent is and when to ask the person", () => {
    expect(SOUL).toContain($NAME_LITERAL);
    // `ask_user` stops the task and puts a question to a person. The guidance
    // for when that is worth doing is shared copy, not this agent's words.
    expect(SOUL).toContain(ASK_GUIDANCE);
  });

  it("describes no capability", () => {
    // Every plugin tells the model what it can do in a context block of its
    // own$SUBAGENT_NOTE — so removing one removes its advice with it. A
    // capability named here would outlive the capability.
    for (const claim of ["you can browse", "you have access to"]) {
      expect(SOUL.toLowerCase()).not.toContain(claim);
    }
  });

  it("tells the model what memory is for", () => {
    expect(MEMORY).not.toBe("");
  });
});
// $when subAgent

describe("GENERAL_SOUL", () => {
  it("writes to a sub-agent that cannot see this conversation", () => {
    // The distinction is structural rather than stylistic: a sub-agent is
    // handed one self-contained task and nothing else, so a soul written as
    // though it could see the conversation is how it ends up asking a follow-up
    // question nobody will ever read.
    expect(GENERAL_SOUL).toContain("self-contained");
    expect(GENERAL_SOUL).toMatch(/do not ask follow-up questions/i);
  });
});
// $end
