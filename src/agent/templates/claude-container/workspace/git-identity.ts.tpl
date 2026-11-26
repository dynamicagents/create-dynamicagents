/**
 * The git identity a session's commits carry in the scratchpad.
 *
 * Fixed rather than configured: nothing this agent writes leaves the container
 * as a commit, so the identity is a label on local history and nothing else.
 */
export function gitIdentity(_env: Env): { name: string; email: string } {
  return { name: "claude-container", email: "" };
}
