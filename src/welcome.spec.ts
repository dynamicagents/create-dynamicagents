import { describe, expect, it } from "vitest";
import { welcome } from "./welcome.js";

describe("welcome", () => {
  it("greets and names the version that ran", () => {
    const text = welcome("1.2.3");
    expect(text).toContain("Welcome to Dynamic Agents");
    expect(text).toContain("create-dynamicagents v1.2.3");
  });
});
