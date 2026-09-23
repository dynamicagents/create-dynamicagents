/** What `npm create dynamicagents` prints. Pure, so the spec needs no process. */
export const welcome = (version: string): string =>
  [
    "",
    `  Welcome to Dynamic Agents  (create-dynamicagents v${version})`,
    "",
    "  Creating gates, leaders and agents is coming soon.",
    "  https://github.com/dynamicagents",
    ""
  ].join("\n");
