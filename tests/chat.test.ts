// The WebSocket chat and feeds, against a stand-in gateway socket.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ChatFrame,
  FrameType,
  isUnauthorized,
  parseFrame,
  SUBPROTOCOL,
  statusCode,
} from "../src/index.js";
import { type FakeSocket, fakeWebSocket, gateway, json, TOKEN } from "./helpers.js";

function chatGateway(serve: (socket: FakeSocket) => void) {
  const sockets: FakeSocket[] = [];
  const WebSocket = fakeWebSocket((socket) => {
    sockets.push(socket);
    serve(socket);
  });
  const { client } = gateway(() => new Response(), { WebSocket });
  return { client, sockets };
}

test("a chat opens on /ws/chat with the subprotocol and the token", async () => {
  const { client, sockets } = chatGateway((s) => {
    s.open();
    s.push({ type: "session_start", session_id: "abc", resumed: true, message_count: 4 });
  });
  const chat = await client.chat("helper", { sessionId: "abc", name: "n" });
  assert.equal(chat.sessionId, "abc");
  assert.equal(chat.resumed, true);
  assert.equal(chat.messageCount, 4);
  const ws = sockets[0]?.ws;
  assert.equal(ws?.url, "ws://gw.test/ws/chat?agent=helper&session_id=abc&name=n");
  assert.deepEqual(ws?.protocols, [SUBPROTOCOL, `bearer.${TOKEN}`]);
  chat.close();
});

test("ask sends the message and returns the end of the turn", async () => {
  const { client } = chatGateway((s) => {
    s.open();
    s.push({ type: "session_start", session_id: "s" });
    s.onSend((frame) => {
      assert.deepEqual(frame, { type: "message", content: "hi" });
      s.push({ type: "chunk", content: "hel" });
      s.push({ type: "tool_call", id: "1", name: "t", args: { a: 1 } });
      s.push({ type: "done", full_response: "hello", input_tokens: 3, model: "m" });
    });
  });
  const chat = await client.chat("helper");
  const done = await chat.ask("hi");
  assert.equal(done.full_response, "hello");
  assert.equal(done.input_tokens, 3);
  chat.close();
});

test("an error frame fails the turn with its code", async () => {
  const { client } = chatGateway((s) => {
    s.open();
    s.push({ type: "session_start", session_id: "s" });
    s.onSend(() => s.push({ type: "error", message: "no credit", code: "PROVIDER_ERROR" }));
  });
  const chat = await client.chat("helper");
  await assert.rejects(chat.ask("hi"), { name: "TurnError", code: "PROVIDER_ERROR" });
  chat.close();
});

test("an aborted turn is a TurnError with code ABORTED", async () => {
  const { client } = chatGateway((s) => {
    s.open();
    s.push({ type: "session_start", session_id: "s" });
    s.onSend(() => s.push({ type: "aborted" }));
  });
  const chat = await client.chat("helper");
  await assert.rejects(chat.ask("hi"), { code: "ABORTED" });
});

test("frames are iterated until the gateway closes the chat", async () => {
  const { client } = chatGateway((s) => {
    s.open();
    s.push({ type: "session_start", session_id: "s" });
    s.onSend((frame) => {
      assert.deepEqual(frame, { type: "approval_response", request_id: "r", decision: "approve" });
      s.push({ type: "plan", steps: [] });
      s.close();
    });
    s.push({
      type: "approval_request",
      request_id: "r",
      tool: "shell",
      arguments_summary: "ls",
      timeout_secs: 30,
    });
  });
  const chat = await client.chat("helper");
  const seen: ChatFrame[] = [];
  for await (const frame of chat) {
    seen.push(frame);
    if (frame.type === FrameType.ApprovalRequest) chat.answerApproval(frame.requestId, "approve");
  }
  assert.deepEqual(
    seen.map((f) => f.type),
    ["approval_request", "plan"],
  );
  assert.equal(seen[0]?.argumentsSummary, "ls");
  assert.equal(seen[0]?.timeoutSecs, 30);
});

test("an error before the session starts fails the chat", async () => {
  const { client } = chatGateway((s) => {
    s.open();
    s.push({ type: "error", message: "unknown agent", code: "AGENT_NOT_FOUND" });
  });
  await assert.rejects(client.chat("nope"), { name: "TurnError", code: "AGENT_NOT_FOUND" });
});

test("a refused handshake is a WebSocketError", async () => {
  const { client } = chatGateway((s) => s.close(1006));
  await assert.rejects(client.chat("helper"), { name: "WebSocketError" });
});

test("a handshake refused for the token is the ApiError of /api/status", async () => {
  const WebSocket = fakeWebSocket((s) => s.close(1006));
  const { client, requests } = gateway(() => json({ error: "Unauthorized" }, 401), { WebSocket });
  const err = await client.chat("helper").catch((e: unknown) => e);
  assert.ok(isUnauthorized(err));
  assert.equal(statusCode(err), 401);
  assert.equal(requests[0]?.url.pathname, "/api/status");
});

test("a connection lost mid-turn is a WebSocketError", async () => {
  const { client } = chatGateway((s) => {
    s.open();
    s.push({ type: "session_start", session_id: "s" });
    s.onSend(() => s.close(1006));
  });
  const chat = await client.chat("helper");
  await assert.rejects(chat.ask("hi"), { name: "WebSocketError" });
});

test("sending on a closed chat is a WebSocketError", async () => {
  const { client } = chatGateway((s) => {
    s.open();
    s.push({ type: "session_start", session_id: "s" });
  });
  const chat = await client.chat("helper");
  chat.close();
  assert.throws(() => chat.send("hi"), { name: "WebSocketError" });
});

test("a feed yields JSON frames and skips nothing", async () => {
  const { client, sockets } = chatGateway((s) => {
    s.open();
    s.push({ type: "snapshot", runs: [] });
    s.push("not json");
    s.push({ type: "run", run: { run_id: "r" } });
    s.close();
  });
  const feed = await client.sops.watchRuns();
  assert.equal(sockets[0]?.ws.url, "ws://gw.test/ws/sops/runs");
  assert.deepEqual(await feed.next(), { type: "snapshot", runs: [] });
  await assert.rejects(feed.next(), { name: "DecodeError" });
  assert.deepEqual(await feed.next(), { type: "run", run: { run_id: "r" } });
  assert.equal(await feed.next(), null);
});

test("a canvas is watched on /ws/canvas/{id}", async () => {
  const { client, sockets } = chatGateway((s) => s.open());
  const feed = await client.canvas.watch("a b");
  assert.equal(sockets[0]?.ws.url, "ws://gw.test/ws/canvas/a%20b");
  feed.close();
});

test("frames parse their fields by type", () => {
  const cases: Array<[unknown, Partial<ChatFrame>]> = [
    [{ type: "chunk", content: "x" }, { content: "x" }],
    [{ type: "thinking", content: "y" }, { content: "y" }],
    [
      { type: "tool_result", id: "1", name: "t", output: 5 },
      { id: "1", output: 5 },
    ],
    [
      { type: "error", error: "legacy" },
      { message: "legacy", code: "" },
    ],
    [{ type: "error" }, { message: "unknown error" }],
    [{ type: "session_start", message_count: 1.5 }, { messageCount: 0 }],
  ];
  for (const [raw, want] of cases) {
    const frame = parseFrame(JSON.stringify(raw));
    for (const [key, value] of Object.entries(want)) {
      assert.deepEqual(frame[key as keyof ChatFrame], value, JSON.stringify(raw));
    }
  }
  assert.throws(() => parseFrame("[]"), { name: "DecodeError" });
  assert.throws(() => parseFrame("{"), { name: "DecodeError" });
});
