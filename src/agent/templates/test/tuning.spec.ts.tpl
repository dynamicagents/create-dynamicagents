import { describe, expect, it } from "vitest";
import { TUNING } from "@/agents/$TENANT/tuning";

/**
 * The numbers. Core ships none, so these are the project's — and two of them
 * are wrong in ways nothing else notices until a long conversation.
 */

describe("TUNING", () => {
  it("keeps less than it compacts", () => {
    // The tail kept verbatim has to fit inside the budget that triggers
    // compaction, or compaction can never make the history smaller.
    expect(TUNING.keepRecentTokens).toBeLessThan(TUNING.compactAfterTokens);
  });

  it("names models the catalogue has", () => {
    const modelId = $MODEL_ID_RE;
    expect(TUNING.modelId).toMatch(modelId);
    expect(TUNING.compactionModelId).toMatch(modelId);
  });
});
