import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { TaskState } from "@a2a-js/sdk";
import {
  AGENT_ORIGIN,
  GATEKEEPER_ORIGIN,
  makeDoHelpers
} from "@dynamicagents/core/testing";
import {
  ARTIFACTS_OBJECT_NAME,
  ARTIFACT_EVENTS,
  SESSION_TRANSCRIPT_KIND,
  parseArtifactPath,
  settleTranscript
} from "@dynamicagents/core/artifacts";
import type { ArtifactEntry } from "@dynamicagents/core/artifacts";
import type { RecipeExecutionRequest } from "@dynamicagents/core/subtasks";
import type { LeaderSubagent } from "@/index";
import worker from "@/index";

/**
 * A subtask's notes, through this harness's facet: a link in the thread, the
 * notes on the transcript.
 *
 * Core decides all of it and has its own specs for the decision. This one is
 * the integration — the same rule, driven through this Worker's facet, this
 * Worker's binding and this Worker's routes, which is the only place the three
 * can disagree. The routes on their own are `artifacts.spec.ts`.
 */

const get = (path: string) =>
  worker.fetch(new Request(`${AGENT_ORIGIN}${path}`), env);

/** The deployment's one artifacts object, addressed the way the routes do. */
const artifacts = () =>
  env.ARTIFACTS.get(env.ARTIFACTS.idFromName(ARTIFACTS_OBJECT_NAME));

/**
 * The `data` payloads carried by one SSE event name, in the order they arrived.
 *
 * Frames are separated by a blank line and `data:` is the last line of each, so
 * everything past it is the JSON — the object never emits a multi-line payload,
 * because `JSON.stringify` cannot put a raw newline inside a string.
 */
const framesOf = <T>(body: string, event: string): T[] =>
  body
    .split("\n\n")
    .filter((frame) => frame.includes(`event: ${event}\n`))
    .map((frame) => JSON.parse(frame.slice(frame.indexOf("data: ") + 6)) as T);

const { freshStub: freshSubagent } = makeDoHelpers(
  (
    env as unknown as {
      LEADER_SUBAGENT: DurableObjectNamespace<LeaderSubagent>;
    }
  ).LEADER_SUBAGENT
);

const TASK_ID = "task-transcript";
const ORDINAL = 2;

const PUSH = {
  taskId: TASK_ID,
  contextId: "ctx-transcript",
  pushUrl: `${GATEKEEPER_ORIGIN}/a2a/notifications`,
  pushToken: "token",
  jku: `${AGENT_ORIGIN}/.well-known/jwks.json`
};

const FIRST = "cloned the repository";
const SECOND = "the suite is green";

/**
 * A chunk that reaches a terminal failure without a model call.
 *
 * `enabled: false` is what makes it deterministic: an unusable recipe is a
 * cacheable terminal failure, and both things this spec needs — the callback
 * channel armed and the origin pinned — happen in `executeChunk` before the
 * recipe is ever validated. What is under test is what the notes do afterwards.
 */
const request = (): RecipeExecutionRequest => ({
  taskId: TASK_ID,
  subtaskId: 1,
  type: "code",
  recipe: {
    key: "code",
    version: 1,
    soul: "unused",
    toolFamilies: [],
    enabled: false,
    limits: {},
    historyWindow: 1,
    reportMetrics: false
  },
  prompt: "unused",
  references: [],
  params: {}
});

describe("a subtask's notes reach the thread as one link", () => {
  it("posts the link once and records every note on the transcript", async () => {
    const posted: { text: string; key: string }[] = [];
    const stub = freshSubagent("transcript-flow");

    await runInDurableObject(stub, async (instance: LeaderSubagent) => {
      (instance as unknown as { pushChannel: () => unknown }).pushChannel =
        () => ({
          // `true` is "the gatekeeper took it", which is what ends the posting.
          // A channel answering `false` is offered the link again on the next
          // note, so a stub that forgot to say would specify the wrong rule.
          working: async (text: string, key: string) => {
            posted.push({ text, key });
            return true;
          }
        });

      // The link is built on the origin in `PUSH.jku`. Without one there is no
      // link to build, and core posts the note verbatim instead.
      await instance.executeChunk(request(), 0, {}, AGENT_ORIGIN, {
        push: PUSH,
        ordinal: ORDINAL
      });

      const post = (
        instance as unknown as {
          postProgress: (e: { key: string; text: string }) => Promise<void>;
        }
      ).postProgress.bind(instance);
      await post({ key: "r1:0", text: FIRST });
      await post({ key: "r1:1", text: SECOND });
    });

    // One post for two notes, and it carries neither of them.
    expect(posted).toHaveLength(1);
    const link = posted[0]!.text;
    expect(link).not.toContain(FIRST);
    expect(link).not.toContain(SECOND);

    const matched = parseArtifactPath(new URL(link).pathname);
    expect(matched?.route).toBe("page");
    const token = matched!.token;

    // The same token the transcript was opened under — so the link a reader is
    // given and the artifact core filed against this task are one artifact.
    expect(await artifacts().tokenFor(SESSION_TRANSCRIPT_KIND, TASK_ID)).toBe(
      token
    );

    await settleTranscript(env, TASK_ID, TaskState.TASK_STATE_COMPLETED);

    const res = await get(`/a/${token}/events`);
    expect(res.status).toBe(200);
    const body = await res.text();

    // Both notes, in order, labelled with the branch that wrote them — the
    // attribution a thread gets in brackets, in the column a transcript has.
    const entries = framesOf<ArtifactEntry>(body, ARTIFACT_EVENTS.entry);
    expect(
      entries.map(({ sequence, label, text }) => ({
        sequence,
        label,
        text
      }))
    ).toEqual([
      { sequence: 1, label: `code ${ORDINAL}`, text: FIRST },
      { sequence: 2, label: `code ${ORDINAL}`, text: SECOND }
    ]);

    expect(framesOf(body, ARTIFACT_EVENTS.settled)).toEqual([
      { status: "completed" }
    ]);
  });
});
