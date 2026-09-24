/**
 * What this subtask harness changes about the leader's config — nothing.
 *
 * Subtasks run core's own tool loop on Workers AI, in a facet, on the same model
 * pair as the parent round, so the parent keeps `MODEL` in `src/config.ts` as it
 * is.
 */
export const PARENT_MODEL = {} as const;
