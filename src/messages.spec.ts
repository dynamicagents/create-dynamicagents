import { describe, expect, it } from "vitest";
import { KINDS, kindOf } from "./kinds.js";
import {
  noTerminal,
  title,
  unknownKind,
  WEBSITE,
  workInProgress
} from "./messages.js";

describe("title", () => {
  it("names the version that ran", () => {
    expect(title("1.2.3")).toContain("create-dynamicagents v1.2.3");
  });
});

describe("workInProgress", () => {
  it("names the kind and where to follow it", () => {
    const text = workInProgress(kindOf("leader")!);
    expect(text).toContain("Leader");
    expect(text).toContain(WEBSITE);
  });
});

describe("noTerminal", () => {
  it("lists every kind and how to name one", () => {
    const text = noTerminal();
    for (const kind of KINDS) expect(text).toContain(kind.value);
    expect(text).toContain("npm create dynamicagents@latest");
  });
});

describe("unknownKind", () => {
  it("quotes what was typed and lists every kind", () => {
    const text = unknownKind("bot");
    expect(text).toContain('"bot"');
    for (const kind of KINDS) expect(text).toContain(kind.value);
  });
});
