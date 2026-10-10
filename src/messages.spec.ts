import { describe, expect, it } from "vitest";
import { BLUEPRINTS } from "./agent/blueprints.js";
import { projectFiles } from "./agent/files.js";
import { specs } from "./agent/fixtures.js";
import { KINDS, kindOf } from "./kinds.js";
import {
  finishByHand,
  link,
  nextSteps,
  noTerminal,
  notEmpty,
  notInstalled,
  otherModelLabel,
  outroLine,
  tree,
  unknownBlueprint,
  unknownKind,
  title,
  WEBSITE,
  workInProgress
} from "./messages.js";
import { MODELS_URL } from "./train.js";

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
  it("lists every kind, and every flag an answer can arrive as", () => {
    const text = noTerminal();
    for (const kind of KINDS) expect(text).toContain(kind.value);
    for (const flag of [
      "--name",
      "--description",
      "--dir",
      "--model",
      "--no-subagent",
      "--browser",
      "--yes",
      "--dry-run"
    ]) {
      expect(text, flag).toContain(flag);
    }
  });

  it("warns about npm's own argument separator", () => {
    // `npm create x agent --name y` keeps the flags for npm. Everybody hits
    // this once; the message is where they find out.
    expect(noTerminal()).toContain("--");
    expect(noTerminal()).toMatch(/npm's/);
  });
});

describe("unknownKind", () => {
  it("quotes what was typed and lists every kind", () => {
    const text = unknownKind("bot");
    expect(text).toContain('"bot"');
    for (const kind of KINDS) expect(text).toContain(kind.value);
  });
});

describe("unknownBlueprint", () => {
  it("quotes what was typed and lists what it can build", () => {
    const text = unknownBlueprint("coding");
    expect(text).toContain('"coding"');
    for (const blueprint of BLUEPRINTS) expect(text).toContain(blueprint.value);
  });
});

describe("link", () => {
  it("is clickable where the terminal takes one", () => {
    const text = link(MODELS_URL, "the catalogue", true);
    expect(text).toContain("\u001B]8;;");
    expect(text).toContain(MODELS_URL);
    expect(text).toContain("the catalogue");
  });

  it("is the bare url everywhere else", () => {
    // An escape sequence in a pipe is noise in somebody's log.
    expect(link(MODELS_URL, "the catalogue", false)).toBe(MODELS_URL);
  });
});

describe("otherModelLabel", () => {
  it("points at the catalogue every id comes from", () => {
    expect(otherModelLabel(false)).toContain(MODELS_URL);
  });
});

describe("tree", () => {
  it("shows what would be written, by directory", () => {
    const text = tree("support", projectFiles(specs.full));
    expect(text).toContain("support/");
    expect(text).toContain("src/agents/support/");
    expect(text).toContain("test/");
    expect(text).toContain("wrangler.jsonc");
  });
});

describe("nextSteps", () => {
  it("names each command in the order the project needs them", () => {
    const text = nextSteps("support", "support");
    const order = ["cd support", "keygen", "check", "test", "dev"];
    let at = -1;
    for (const step of order) {
      const found = text.indexOf(step);
      expect(found, step).toBeGreaterThan(at);
      at = found;
    }
  });

  it("says the soul is the part nobody else can write", () => {
    const text = nextSteps("support", "support");
    expect(text).toContain("src/agents/support/soul.ts");
    expect(text).toContain("/a2a");
  });
});

describe("the refusals", () => {
  it("say what to do instead", () => {
    expect(notEmpty("support")).toMatch(/does not exist yet|empty/);
  });
});

describe("finishByHand", () => {
  it("carries the problem and the two commands that finish it", () => {
    const text = finishByHand("support", "npm install failed");
    expect(text).toContain("npm install failed");
    expect(text).toContain("cd support");
    expect(text).toContain("npm install");
    expect(text).toContain("npx wrangler types");
  });
});

describe("notInstalled", () => {
  it("names the agent and does not call it ready", () => {
    // It replaces the success outro, so the one thing it must not do is read
    // like one: nothing in the project runs until the install is finished.
    const text = notInstalled("Support");
    expect(text).toContain("Support");
    expect(text).not.toMatch(/ready/i);
    expect(outroLine("Support")).toMatch(/ready/i);
  });
});
