import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { AGENT_ORIGIN } from "@dynamicagents/core/testing";
import {
  ARTIFACTS_OBJECT_NAME,
  ARTIFACT_EVENTS,
  mintArtifactToken
} from "@dynamicagents/core/artifacts";
import worker from "@/index";

/**
 * The `ARTIFACTS` wiring, end to end through this Worker.
 *
 * Core owns the object, the routes and the rule about what a thread gets, and
 * specifies all three against its own harness. What is asserted here is the
 * part core cannot reach: that *this* deployment declared the binding, exported
 * the class under the name the namespace is keyed by, applied a migration for
 * it, and put the route delegation in front of the A2A router. Every one of
 * those fails silently in a different place — at DO start, at deploy, at the
 * first request, or only when somebody opens a link — and none of them is
 * visible to a typechecker.
 *
 * The suite runs against the real binding: `vitest.config.ts` builds `env` from
 * `wrangler.jsonc`, so a spec here passing means that file declared it.
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

describe("the artifact routes answer", () => {
  it("serves the viewer page on a well-formed token path", async () => {
    // A token this deployment never minted, deliberately: the page is the same
    // bytes for every artifact and is served without consulting the object, so
    // a 200 here is about the route being mounted and the binding resolving —
    // which is the whole of what this repo owns.
    const res = await get(`/a/${mintArtifactToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
  });

  it("streams an artifact on the events route", async () => {
    const token = await artifacts().createArtifact("session-transcript-probe");
    await artifacts().settle(token, "completed");

    const res = await get(`/a/${token}/events`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
    // Reading to the end terminates only because the artifact settled before
    // the stream opened; a live one holds the connection open by design.
    const body = await res.text();
    expect(framesOf(body, ARTIFACT_EVENTS.ready)).toEqual([
      { kind: "session-transcript-probe", status: "completed" }
    ]);
  });

  it("leaves a path it does not claim to the A2A worker", async () => {
    // Under the prefix, carrying something this package could not have minted.
    // The helper answers `null` for it rather than 404ing on the way past, so
    // it must arrive wherever an unrouted path arrives — mounting the routes
    // in front of the router must not be an act with consequences elsewhere.
    const unclaimed = await get("/a/not-a-token");
    const unrouted = await get("/no-such-path");

    expect([unclaimed.status, await unclaimed.text()]).toEqual([
      unrouted.status,
      await unrouted.text()
    ]);
  });

  it("still serves what the A2A worker routes", async () => {
    // The other half of the ordering: delegating first must shadow nothing.
    expect((await get(`/${AGENT_CARD_PATH}`)).status).toBe(200);
  });
});
