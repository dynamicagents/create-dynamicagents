import { describe, expect, it } from "vitest";
import { render } from "./render";

/**
 * The substitution every `.tpl` file goes through, and every way it refuses.
 *
 * Two things are under test and they pull in opposite directions. One is that
 * the mechanism is **dumb**: one pass, no rescanning, no blank-line
 * normalisation, nothing clever about what it is substituting into. The other
 * is that it is **strict** — a binding nothing reads, a flag no region names, a
 * region naming no flag and an unbound token are all errors, because every one
 * of them is a template that would otherwise write something subtly wrong into
 * somebody's new project and say nothing.
 */

describe("tokens", () => {
  it("substitutes every occurrence", () => {
    expect(render("$A and $A and $B", { tokens: { A: "x", B: "y" } })).toBe(
      "x and x and y"
    );
  });

  it("takes the longest name, so one token is never a prefix of another", () => {
    expect(render("$DIRECTORY", { tokens: { DIRECTORY: "src" } })).toBe("src");
  });

  it("leaves a lowercase or braced dollar alone", () => {
    // `"$schema"` is real — `wrangler.jsonc` opens with it — and `${…}` is in
    // every generated file that builds a string, which is most of them.
    const source = '"$schema": "…", `${count} of ${total}`, $x';
    expect(render(source)).toBe(source);
  });

  it("never rescans what it substituted", () => {
    // A description somebody typed is substituted text, and `$&` is what
    // `String.prototype.replace` would read as the whole match if the
    // replacement were a string rather than a function.
    expect(render("$WHAT", { tokens: { WHAT: "costs $USD or $& each" } })).toBe(
      "costs $USD or $& each"
    );
  });

  it("refuses a token it was given nothing for", () => {
    expect(() => render("$A $B", { tokens: { A: "x" } })).toThrow(
      '"$B" is not bound'
    );
  });

  it("refuses a binding nothing in the template reads", () => {
    expect(() => render("$A", { tokens: { A: "x", GONE: "y" } })).toThrow(
      'nothing in this template reads "$GONE"'
    );
  });

  it("allows a binding only a dropped region reads", () => {
    // The check reads the source before any region goes, so a token inside
    // `$when` is bound whether that region is taken or not — which is what
    // lets a module bind its tokens unconditionally.
    const source = ["keep", "// $when extra", "$WHO", "// $end"].join("\n");
    expect(
      render(source, { when: { extra: false }, tokens: { WHO: "x" } })
    ).toBe("keep");
  });
});

describe("regions", () => {
  const source = (...body: string[]): string =>
    ["before", "// $when flag", ...body, "// $end", "after"].join("\n");

  it("keeps the body and drops the markers when the flag is true", () => {
    expect(render(source("inside"), { when: { flag: true } })).toBe(
      "before\ninside\nafter"
    );
  });

  it("drops the body when the flag is false", () => {
    expect(render(source("inside"), { when: { flag: false } })).toBe(
      "before\nafter"
    );
  });

  it("inverts with `!`", () => {
    const inverted = ["a", "// $when !flag", "b", "// $end", "c"].join("\n");
    expect(render(inverted, { when: { flag: false } })).toBe("a\nb\nc");
    expect(render(inverted, { when: { flag: true } })).toBe("a\nc");
  });

  // `//` for TypeScript, JavaScript and JSONC, `#` for `.gitignore` and
  // `.env.example`, `*` for a continuation line inside a block comment — and
  // whatever indentation the file it sits in happens to use, since prettier
  // indents a marker inside a block the way it indents everything else.
  it.each([
    ["//", ""],
    ["#", ""],
    ["*", " "],
    ["//", "    "],
    ["   *", " "]
  ])('reads "%s%s$when" as a marker', (comment, space) => {
    const lines = [
      `${comment}${space}$when flag`,
      "x",
      `${comment}${space}$end`
    ];
    expect(render(lines.join("\n"), { when: { flag: false } })).toBe("");
    expect(render(lines.join("\n"), { when: { flag: true } })).toBe("x");
  });

  it("leaves one blank line when the blank line is inside the region", () => {
    // The convention, and the reason no generated file ends up with two
    // consecutive blank lines: the blank separating a region from what follows
    // goes *above* the `$end`. Both ways through here leave exactly one.
    const spaced = [
      "const a = 1;",
      "",
      "// $when flag",
      "const b = 2;",
      "",
      "// $end",
      "const c = 3;"
    ].join("\n");
    expect(render(spaced, { when: { flag: false } })).toBe(
      "const a = 1;\n\nconst c = 3;"
    );
    expect(render(spaced, { when: { flag: true } })).toBe(
      "const a = 1;\n\nconst b = 2;\n\nconst c = 3;"
    );
  });

  it("substitutes tokens in a region it kept, and not in one it dropped", () => {
    const both = [
      "// $when flag",
      "$WHO",
      "// $end",
      "// $when !flag",
      "nobody",
      "// $end"
    ].join("\n");
    expect(
      render(both, { when: { flag: true }, tokens: { WHO: "$NOT_A" } })
    ).toBe("$NOT_A");
    expect(render(both, { when: { flag: false }, tokens: { WHO: "x" } })).toBe(
      "nobody"
    );
  });

  it("refuses a flag no region names", () => {
    expect(() => render("plain", { when: { flag: true } })).toThrow(
      'no "$when flag" region'
    );
  });

  it("refuses a region naming a flag it was given nothing for", () => {
    expect(() => render(source("x"), { when: { other: true } })).toThrow();
    expect(() => render(source("x"))).toThrow(
      '"$when flag" names an unbound flag'
    );
  });

  it("refuses nesting rather than implementing it", () => {
    const nested = ["// $when a", "// $when b", "x", "// $end", "// $end"].join(
      "\n"
    );
    expect(() => render(nested, { when: { a: true, b: true } })).toThrow(
      '"$when b" nested inside "$when a"'
    );
  });

  it("refuses a region left open", () => {
    expect(() => render("// $when flag\nx", { when: { flag: true } })).toThrow(
      '"$when flag" is never closed'
    );
  });

  it("refuses an `$end` with nothing open", () => {
    expect(() => render("x\n// $end")).toThrow('"$end" without "$when"');
  });

  it("refuses a named `$end`, which would read as a closing tag", () => {
    expect(() =>
      render("// $when flag\nx\n// $end flag", { when: { flag: true } })
    ).toThrow('"$end" takes no name');
  });

  it("leaves a comment that only mentions a marker alone", () => {
    // The whole line has to be the marker. A sentence about `$when` in a
    // generated file's own documentation is prose.
    const prose =
      "// Regions are written `// $when flag`, and this is not one.";
    expect(render(prose)).toBe(prose);
  });
});

describe("blocks", () => {
  it("replaces the whole marker line with the token's text", () => {
    const source = [
      "export class A extends B<Env> {",
      "  protected readonly copy = copy;",
      "  // $block FIELDS",
      "}"
    ].join("\n");
    expect(
      render(source, {
        tokens: { FIELDS: '  readonly a = "x";\n  readonly b = "y";' }
      })
    ).toBe(
      'export class A extends B<Env> {\n  protected readonly copy = copy;\n  readonly a = "x";\n  readonly b = "y";\n}'
    );
  });

  it("takes its indentation from the block, not from the marker", () => {
    // The marker is indented so that prettier leaves the template alone; what
    // reaches the output is indented by the helper that laid the block out.
    expect(render("        // $block B", { tokens: { B: "  two" } })).toBe(
      "  two"
    );
  });

  it("never rescans the text it inserted", () => {
    expect(render("// $block B", { tokens: { B: "$NOT_A_TOKEN" } })).toBe(
      "$NOT_A_TOKEN"
    );
  });

  it("goes with the region it is in", () => {
    const source = ["// $when flag", "// $block B", "// $end"].join("\n");
    expect(render(source, { when: { flag: false }, tokens: { B: "x" } })).toBe(
      ""
    );
    expect(render(source, { when: { flag: true }, tokens: { B: "x" } })).toBe(
      "x"
    );
  });

  it("counts as reading its token, so the binding is not called dead", () => {
    expect(render("// $block B", { tokens: { B: "x" } })).toBe("x");
  });

  it("refuses a block it was given nothing for", () => {
    expect(() => render("// $block B")).toThrow('"$block B" is not bound');
  });

  it("refuses a block with no name", () => {
    expect(() => render("// $block")).toThrow('"$block" names no token');
  });

  it("refuses a negated block — the `!` form is `$when`'s alone", () => {
    // Caught a step earlier than the marker itself, by the guard on a binding
    // nothing reads: `$block !B` names no token, so there is no `B` in the
    // template for the `B` the module passed.
    expect(() => render("// $block !B", { tokens: { B: "x" } })).toThrow(
      'nothing in this template reads "$B"'
    );
    expect(() => render("// $block !B")).toThrow('"$block" names no token');
  });

  it("leaves a comment that merely mentions a block alone", () => {
    const prose = "// A computed piece is written `// $block NAME`.";
    expect(render(prose)).toBe(prose);
  });
});
