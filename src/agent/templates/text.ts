/**
 * Emitting generated source the way prettier would.
 *
 * A generated project runs `prettier --check .` as the first half of its own
 * `npm run check`, so anything this CLI writes has to be formatted *already* —
 * output that merely parses would hand every new project a failing check on its
 * first run. Prettier is a devDependency and cannot be imported at runtime
 * (nothing a user installs would have it), so the rules that actually bite are
 * implemented here and held to the real prettier in `../formatting.spec.ts`,
 * which sweeps lengths across the print width rather than trusting a fixture.
 *
 * Every rule below was measured against prettier, not assumed:
 *
 * - **A quoted string** prefers double quotes, and single quotes when that
 *   escapes fewer characters. `JSON.stringify` always escapes instead.
 * - **A string-valued property** stays on one line while the line fits
 *   {@link PRINT_WIDTH}, and otherwise breaks after the colon. A string itself
 *   is never split: one longer than the width simply overflows, as prettier
 *   leaves it.
 * - **An array of short values** is inline while it fits, and one element per
 *   line when it does not. `JSON.stringify` always expands, which is why
 *   {@link jsonFile} is only for values with no array in them.
 * - **A markdown table** has every cell padded to its column's width, and
 *   emphasis spelled `_like this_`.
 */

/** Prettier's default, and what every repository in the train uses. */
export const PRINT_WIDTH = 80;

/**
 * A value as a quoted literal, with the quote prettier would pick: double
 * unless the string holds double quotes and no single ones.
 */
export function quoted(value: string): string {
  const json = JSON.stringify(value);
  if (!value.includes('"') || value.includes("'")) return json;
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * One `key: "value"` property of an object literal, laid out as prettier lays
 * it out. `indent` is the property's own indentation in spaces.
 *
 * The trailing comma counts toward the width. Properties built with this are
 * joined with `",\n"`, which works for both layouts because each ends with the
 * value.
 */
export function stringProp(key: string, value: string, indent = 2): string {
  const pad = " ".repeat(indent);
  const literal = quoted(value);
  if (`${pad}${key}: ${literal},`.length <= PRINT_WIDTH) {
    return `${pad}${key}: ${literal}`;
  }
  return `${pad}${key}:\n${pad}  ${literal}`;
}

/**
 * One `import`/`export … from` statement, laid out as prettier lays it out: on
 * one line while it fits, otherwise one specifier per line.
 *
 * The path is what reaches the width here — `@/agents/<tenant>/children` with a
 * long tenant id and a long class name beside it is past 80 columns on its own
 * — which is why this is a rule rather than a judgement made per template.
 *
 * A single specifier is never broken, however long the line: prettier leaves it,
 * because breaking it buys nothing when the path is what overflows.
 */
export function namedFrom(
  keyword: "import" | "export",
  names: readonly string[],
  from: string
): string {
  const inline = `${keyword} { ${names.join(", ")} } from ${quoted(from)};`;
  if (names.length < 2 || inline.length <= PRINT_WIDTH) return inline;
  return `${keyword} {\n${names.map((name) => `  ${name}`).join(",\n")}\n} from ${quoted(from)};`;
}

/**
 * One `<left> = "value";` statement — a class field, usually — laid out as
 * prettier lays it out: on one line while it fits, otherwise broken after the
 * `=` with the string indented one level further.
 *
 * A long tenant id is what reaches this: `SOMETHING_RATHER_LONG_WORKFLOW` on a
 * `protected readonly workflowBinding: string` is past the width on its own.
 */
export function assigned(left: string, value: string, indent = 2): string {
  const pad = " ".repeat(indent);
  const literal = quoted(value);
  const inline = `${pad}${left} = ${literal};`;
  if (inline.length <= PRINT_WIDTH) return inline;
  return `${pad}${left} =\n${pad}  ${literal};`;
}

/** The same, for an array of strings: inline while it fits. */
export function arrayProp(
  key: string,
  values: readonly string[],
  indent = 2
): string {
  const pad = " ".repeat(indent);
  const items = values.map(quoted);
  const inline = `${pad}${key}: [${items.join(", ")}],`;
  if (inline.length <= PRINT_WIDTH) {
    return `${pad}${key}: [${items.join(", ")}]`;
  }
  return `${pad}${key}: [\n${items.map((item) => `${pad}  ${item}`).join(",\n")}\n${pad}]`;
}

/** The same again, for JSON — where the key is quoted. */
export const jsonArrayProp = (
  key: string,
  values: readonly string[],
  indent = 2
): string => arrayProp(quoted(key), values, indent);

/**
 * One JSON object of string values, as an element of an array: inline while it
 * fits, one property per line when it does not. A long tenant id is what makes
 * the difference, so this is swept in `../formatting.spec.ts` rather than eyed.
 *
 * Elements built with this are joined with `",\n"`.
 */
export function jsonObject(
  entries: readonly [string, string][],
  indent: number
): string {
  const pad = " ".repeat(indent);
  const pairs = entries.map(
    ([key, value]) => `${quoted(key)}: ${quoted(value)}`
  );
  const inline = `${pad}{ ${pairs.join(", ")} },`;
  if (inline.length <= PRINT_WIDTH) return `${pad}{ ${pairs.join(", ")} }`;
  return `${pad}{\n${pairs.map((pair) => `${pad}  ${pair}`).join(",\n")}\n${pad}}`;
}

/**
 * A JSON file, formatted as prettier formats one.
 *
 * **Only for values with no array in them.** Prettier collapses a short array
 * onto one line and `JSON.stringify` never does, so anything with an array is
 * written out as a template instead — `tsconfig.json` and `wrangler.jsonc` are.
 */
export const jsonFile = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

/** One line of prose as an array element: `  "…"`. Joined with `",\n"`. */
export const line = (text: string, indent = 2): string =>
  `${" ".repeat(indent)}${quoted(text)}`;

/**
 * A markdown table, with the column padding prettier applies.
 *
 * Padded to the widest cell in each column, and the separator row filled with
 * dashes to the same width. Width is counted in code points, which is what
 * prettier does for the characters these tables use.
 */
export function mdTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  const widths = headers.map((header, column) =>
    Math.max(
      [...header].length,
      3,
      ...rows.map((row) => [...(row[column] ?? "")].length)
    )
  );
  const pad = (cell: string, column: number): string =>
    cell + " ".repeat(widths[column]! - [...cell].length);
  const render = (cells: readonly string[]): string =>
    `| ${cells.map((cell, column) => pad(cell, column)).join(" | ")} |`;

  return [
    render(headers),
    `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
    ...rows.map(render)
  ].join("\n");
}
