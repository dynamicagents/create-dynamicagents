/**
 * Binding the variation in a `.tpl` file: what a template reads.
 *
 * Every file this CLI writes lives beside its module as a `.tpl` — a real file
 * on disk, byte-for-byte what the user gets, which esbuild's `text` loader
 * compiles into the bundle (see `scripts/build.mjs`). That buys prettier,
 * diffs and syntax highlighting over the generated text, and costs a way to
 * say "this part varies". There are three, and all three are written so that
 * **the template stays valid in the language it writes** — which is the whole
 * reason prettier can be run over it:
 *
 * - **An inline token**, `$UPPER_SNAKE`, substituted from
 *   {@link Bindings.tokens}. Four kinds: a *name* (`$AGENT_CLASS`), a *literal*
 *   (a complete quoted literal from `quoted()`, since user text may hold a
 *   quote), a *phrase* (a possibly-empty mid-sentence fragment), and a *value*
 *   that a helper in `./text.ts` laid out.
 * - **A block**, `$block NAME` on a comment line, whose whole line is replaced
 *   by that token's text. For the computed pieces: a varying number of
 *   elements, or a layout that depends on the value.
 * - **A region**, `$when name` / `$when !name` / `$end` on comment lines,
 *   including or dropping the text between them. **The blank line belongs
 *   inside the region** — on whichever side of it the layout needs, but never
 *   outside. No generated file contains two consecutive blank lines, and
 *   nothing here normalises them: that convention is what makes a dropped
 *   region leave exactly one, and a mistake a loud failure in
 *   `../formatting.spec.ts` rather than a quiet reformat.
 *
 * Text goes in a file when every variation in it is an inline token at a
 * position whose prettier layout does not depend on the value, a block, or a
 * whole-region inclusion. It stays computed — and arrives as a block — when the
 * *structure* is computed, or when prettier's layout depends on the substituted
 * value: `assigned`, `stringProp`, `jsonObject`, `mdTable` and a multi-name
 * `namedFrom` all break differently past the print width.
 *
 * **Why a block is a comment line and not a bare `$NAME` line.** A bare token
 * standing where a statement, a class member or an array element goes is not
 * valid source, and prettier does not merely dislike it: it appends a `;` to a
 * class member, appends a `,` to an object property, and *collapses*
 * `[\n$SKILLS\n]` onto one line. A comment it keeps exactly where it is, in
 * every language here — so the comment form is what lets a template with
 * computed pieces in it still be formatted by the formatter whose output it has
 * to match.
 *
 * Pure, and nothing imported: this is as much a part of the bundle as the text
 * it renders.
 */

/** What one template binds: the flags its regions read, and its tokens. */
export interface Bindings {
  /**
   * The flag each `$when` names. Rendering throws on a name no region uses and
   * on a region naming no flag, so a renamed condition cannot go quiet.
   */
  when?: Readonly<Record<string, boolean>>;
  /**
   * The text each `$TOKEN` and each `$block TOKEN` stands for. A key that
   * appears nowhere in the source throws; a key used only inside a region that
   * this render drops is fine, because the check reads the source before any
   * region goes.
   */
  tokens?: Readonly<Record<string, string>>;
}

/**
 * A `$when`, `$end` or `$block` marker line, matched against the line's
 * trimmed content.
 *
 * `//` for TypeScript, JavaScript and JSONC, `*` for a continuation line inside
 * a block comment, `#` for `.gitignore` and `.env.example` — a comment in every
 * host language a template uses, which is what keeps a `.tpl` file
 * prettier-formattable with its markers still in it.
 *
 * Markdown has no marker form on purpose: prettier splits a list and inserts
 * blank lines around an `<!-- … -->` between two items, so a region there would
 * reformat the text it is holding. A `.md.tpl` varies by inline token only —
 * which costs it nothing, because markdown has no syntax for a bare token to
 * violate and prose is where a table or a phrase can simply stand.
 */
const MARKER =
  /^(?:\/\/|#|\*)\s*\$(when|end|block)\b(?:\s+(!?)([A-Za-z]\w*))?\s*$/;

/** An inline token: `$` and an UPPER_SNAKE name, longest run first. */
const TOKEN = /\$[A-Z][A-Z0-9_]*/g;

/**
 * Render one template source against its bindings.
 *
 * One pass, line by line: a line is dropped with its region, replaced whole by
 * a block, or has its inline tokens substituted. One pass is the point — a
 * substituted value is never rescanned, so user text holding `$NAME` or `$&` is
 * text rather than a second substitution, which is also why the replacement is
 * a function and not a string, `String.prototype.replace` reading `$&` and `$1`
 * in the latter.
 *
 * An unknown token throws *where it is found*, rather than being caught by a
 * sweep over the result: a sweep could not tell a token this never bound from a
 * `$WORD` inside a description somebody typed.
 *
 * Nesting is refused rather than implemented. Nothing needs it, and a template
 * that wants it is a template that should be two files or a block.
 */
export function render(source: string, bindings: Bindings = {}): string {
  const when = bindings.when ?? {};
  const tokens = bindings.tokens ?? {};
  const lines = source.split("\n");

  const named = new Set<string>();
  for (const line of lines) {
    const marker = MARKER.exec(line.trim());
    if (marker?.[1] === "when" && marker[3] !== undefined) named.add(marker[3]);
  }
  for (const name of Object.keys(when)) {
    if (!named.has(name)) {
      throw new Error(`render: no "$when ${name}" region in this template`);
    }
  }
  for (const name of Object.keys(tokens)) {
    // `$NAME` inline, or `$block NAME` on a line of its own.
    if (!source.includes(`$${name}`) && !source.includes(`$block ${name}`)) {
      throw new Error(`render: nothing in this template reads "$${name}"`);
    }
  }

  const bound = (name: string, what: string): string => {
    const value = tokens[name];
    if (value === undefined) throw new Error(`render: "${what}" is not bound`);
    return value;
  };

  const kept: string[] = [];
  let open: { name: string; keep: boolean } | undefined;

  for (const line of lines) {
    const marker = MARKER.exec(line.trim());
    if (marker === null) {
      if (open === undefined || open.keep) {
        kept.push(line.replace(TOKEN, (token) => bound(token.slice(1), token)));
      }
      continue;
    }

    const [, directive, negated, name] = marker;

    if (directive === "block") {
      if (name === undefined || negated === "!") {
        throw new Error(`render: "$block" names no token in "${line.trim()}"`);
      }
      // The block carries its own indentation, from the helper that laid it
      // out; this line's indentation is there for the formatter alone.
      if (open === undefined || open.keep) {
        kept.push(bound(name, `$block ${name}`));
      }
      continue;
    }

    if (directive === "end") {
      if (name !== undefined) {
        throw new Error(`render: "$end" takes no name, got "${line.trim()}"`);
      }
      if (open === undefined) throw new Error('render: "$end" without "$when"');
      open = undefined;
      continue;
    }

    if (name === undefined) {
      throw new Error(`render: "$when" names no flag in "${line.trim()}"`);
    }
    if (open !== undefined) {
      throw new Error(
        `render: "$when ${name}" nested inside "$when ${open.name}"`
      );
    }
    const flag = when[name];
    if (flag === undefined) {
      throw new Error(`render: "$when ${name}" names an unbound flag`);
    }
    open = { name, keep: negated === "!" ? !flag : flag };
  }

  if (open !== undefined) {
    throw new Error(`render: "$when ${open.name}" is never closed`);
  }
  return kept.join("\n");
}
