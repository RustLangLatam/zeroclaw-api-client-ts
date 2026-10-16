// The Server-Sent Events stream: framing, keep-alives, chunking and errors.

import assert from "node:assert/strict";
import { test } from "node:test";
import { eventKind, type GatewayEvent, isLogEvent } from "../src/index.js";
import { gateway } from "./helpers.js";

/** A streamed answer that sends `chunks` one by one. */
function stream(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

async function collect(chunks: string[]): Promise<GatewayEvent[]> {
  const { client, requests } = gateway(() => stream(chunks));
  const events: GatewayEvent[] = [];
  for await (const event of await client.events.subscribe()) events.push(event);
  assert.equal(requests[0]?.url.pathname, "/api/events");
  assert.equal(requests[0]?.headers.get("accept"), "text/event-stream");
  return events;
}

test("frames are data lines ended by a blank line", async () => {
  const events = await collect([
    ': keep-alive\n\ndata: {"type":"agent_start"}\n\n',
    'data: {"@timestamp":"t","event":"x"}\n\n',
  ]);
  assert.deepEqual(events, [{ type: "agent_start" }, { "@timestamp": "t", event: "x" }]);
  assert.equal(eventKind(events[0] as GatewayEvent), "agent_start");
  assert.equal(eventKind(events[1] as GatewayEvent), "");
  assert.ok(isLogEvent(events[1] as GatewayEvent));
});

test("frames split across chunks, CRLF, multi-line data and a last frame without its blank line", async () => {
  const events = await collect([
    "da",
    'ta: {"type":',
    '"a"}\r',
    "\n\r\n",
    'data: {"type":\n',
    'data: "b"}\n\n',
    "event: ignored\nid: 1\n",
    'data:{"type":"c"}',
  ]);
  assert.deepEqual(events.map(eventKind), ["a", "b", "c"]);
});

test("a frame that is not JSON throws, and the stream goes on", async () => {
  const { client } = gateway(() => stream(["data: nope\n\n", 'data: {"type":"ok"}\n\n']));
  const events = await client.events.subscribe();
  await assert.rejects(events.next(), { name: "DecodeError" });
  assert.deepEqual(await events.next(), { type: "ok" });
  assert.equal(await events.next(), null);
});

test("a frame that is not an object throws", async () => {
  const { client } = gateway(() => stream(["data: [1]\n\n"]));
  await assert.rejects((await client.events.subscribe()).next(), { name: "DecodeError" });
});

test("closing the stream ends it", async () => {
  const { client } = gateway(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"type":"a"}\n\n'));
          },
        }),
      ),
  );
  const events = await client.events.subscribe();
  assert.deepEqual(await events.next(), { type: "a" });
  await events.close();
  assert.equal(await events.next(), null);
});

test("a dropped stream is a TransportError", async () => {
  const { client } = gateway(
    () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new Error("connection reset"));
          },
        }),
      ),
  );
  await assert.rejects((await client.events.subscribe()).next(), { name: "TransportError" });
});
