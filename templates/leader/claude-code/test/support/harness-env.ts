/**
 * Test values for the secrets this harness adds to `secrets.required`, which
 * `vitest.config.ts` seeds alongside the ones every leader has.
 *
 * The credential pool, never real: nothing in the suite reaches Anthropic — the
 * egress gateway is tested against a stubbed `fetch` in `@dynamicagents/plugins`,
 * and no spec here starts a session. One entry per name in `wrangler.jsonc`'s
 * `secrets.required`.
 */
export const HARNESS_TEST_ENV: Record<string, string> = {
  CLAUDE_CODE_OAUTH_TOKEN_1: "sk-ant-oat01-test-1",
  CLAUDE_CODE_OAUTH_TOKEN_2: "sk-ant-oat01-test-2",
  CLAUDE_CODE_OAUTH_TOKEN_3: "sk-ant-oat01-test-3"
};
