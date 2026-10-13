/**
 * Binding the variation in a `.tpl` file: what a template reads.
 *
 * Every file this CLI writes lives beside its module as a `.tpl` — a real file
 * on disk, byte-for-byte what the user gets, which esbuild's `text` loader
 * compiles into the bundle (see `scripts/build.mjs`). That buys prettier,
 * diffs and syntax highlighting over the generated text, and costs a way to
 * say "this part varies". There are exactly two:
 *
 * - **A token**, `$UPPER_SNAKE`, substituted from {@link Bindings.tokens}. Five
 *   kinds, and the kind is the criterion for what may live in a file at all —
 *   a *name* (`$AGENT_CLASS`), a *literal* (a complete quoted literal from
 *   `quoted()`, since user text may hold a quote), a *phrase* (a possibly-empty
 *   mid-sentence fragment), or a whole *line* or *block* whose layout came
 *   from a helper in `./text.ts`.
 * - **A region**, `$when name` / `$when !name` / `$end` on comment lines,
 *   including or dropping the text between them.
 *
 * Text goes in a file when every variation in it is a token at a position
 * whose prettier layout does not depend on the value, or a whole-line or
 * whole-block inclusion. It stays computed when the *structure* is computed — a
 * varying number of elements — or when prettier's layout depends on the
 * substituted value: `assigned`, `stringProp`, `jsonObject` and a multi-name
 * `namedFrom` all break differently past the print width, so those keep their
 * helper and arrive as a line token.
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
   * The text each `$TOKEN` stands for. A key that appears nowhere in the source
   * throws; a key used only inside a region that this render drops is fine,
   * because the check reads the source before any region goes.
   */
  tokens?: Readonly<Record<string, string>>;
}

/**
 * A `$when`/`$end` marker line, matched against the line's trimmed content.
 *
 * `//` for TypeScript, JavaScript and JSONC, `*` for a continuation line inside
 * a block comment, `#` for `.gitignore` and `.env.example` — a comment in every
 * host language a template uses, which is what keeps a `.tpl` file
 * prettier-formattable with its regions still in it.
 *
 * Markdown has no region form on purpose: prettier splits a list and inserts
 * blank lines around an `<!-- … -->` between two items, so a region there would
 * reformat the text it is holding. The markdown templates vary by token only.
 */
const MARKER = /^(?:\/\/|#|\*)\s*\$(when|end)\b(?:\s+(!?)([A-Za-z]\w*))?\s*$/;

/** A token: `$` and an UPPER_SNAKE name, longest run first. */
const TOKEN = /\$[A-Z][A-Z0-9_]*/g;

/**
 * Render one template source against its bindings.
 *
 * Regions first, then tokens in a single pass. One pass is the point: a
 * substituted value is never rescanned, so user text holding `$NAME` or `$&`
 * is text rather than a second substitution — which is also why the
 * replacement is a function and not a string, `String.prototype.replace`
 * reading `$&` and `$1` in the latter.
 *
 * An unknown token throws *where it is found*, rather than being caught by a
 * sweep over the result: a sweep could not tell a token this never bound from
 * a `$WORD` inside a description somebody typed.
 */
export function render(source: string, bindings: Bindings = {}): string {
  const when = bindings.when ?? {};
  const tokens = bindings.tokens ?? {};

  const named = regionNames(source);
  for (const name of Object.keys(when)) {
    if (!named.has(name)) {
      throw new Error(`render: no "$when ${name}" region in this template`);
    }
  }
  for (const name of Object.keys(tokens)) {
    if (!source.includes(`$${name}`)) {
      throw new Error(`render: nothing in this template reads "$${name}"`);
    }
  }

  return regions(source, when).replace(TOKEN, (token) => {
    const value = tokens[token.slice(1)];
    if (value === undefined) {
      throw new Error(`render: "${token}" is not bound`);
    }
    return value;
  });
}

/** Every flag a `$when` in this source names. */
function regionNames(source: string): Set<string> {
  const found = new Set<string>();
  for (const line of source.split("\n")) {
    const marker = MARKER.exec(line.trim());
    if (marker?.[1] === "when" && marker[3] !== undefined) {
      found.add(marker[3]);
    }
  }
  return found;
}

/**
 * Drop the regions whose flag is false, and every marker line with them.
 *
 * **The blank line belongs inside the region** — the one separating a region
 * from what follows it goes above the `$end`, never below it. No generated file
 * contains two consecutive blank lines, and nothing here normalises them: that
 * convention is what makes a dropped region leave exactly one, and a mistake a
 * loud failure in `../formatting.spec.ts` rather than a quiet reformat.
 *
 * Nesting is refused rather than implemented. Nothing needs it, and a template
 * that wants it is a template that should be two files or a computed block.
 */
function regions(source: string, when: Readonly<Record<string, boolean>>) {
  const kept: string[] = [];
  let open: { name: string; keep: boolean } | undefined;

  for (const line of source.split("\n")) {
    const marker = MARKER.exec(line.trim());
    if (marker === null) {
      if (open === undefined || open.keep) kept.push(line);
      continue;
    }

    const [, directive, negated, name] = marker;
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
