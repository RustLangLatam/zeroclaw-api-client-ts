# Chatting with an agent

## Over the WebSocket

`await client.chat(alias)` opens `/ws/chat` for agent `alias` and waits for
the gateway to confirm the session. The connection is a session
(`gw_<sessionId>`); pass `{ sessionId }` to resume one, and `name` or `cwd`
to name it or set its working directory. Close the returned `ChatSession`
when done.

`ask` sends a message and waits for the reply:

```ts
const chat = await client.chat("helper");
try {
  const reply = await chat.ask("How many orders are pending?");
  console.log(reply.full_response, reply.tokens_used);
} finally {
  chat.close();
}
```

To show progress, or to answer tool approvals, iterate the frames.
`frame.type` is one of `FrameType` and says which fields are set:

```ts
import { FrameType, TurnError } from "zeroclaw-api-client";

const chat = await client.chat("helper");
chat.send("Archive last month's invoices");
for await (const frame of chat) {
  // Ends when the gateway closes the chat.
  if (frame.type === FrameType.Chunk) render(frame.content);
  else if (frame.type === FrameType.ToolCall) console.log("running", frame.name);
  else if (frame.type === FrameType.ApprovalRequest) chat.answerApproval(frame.requestId, "approve");
  else if (frame.type === FrameType.Done) break; // frame.done holds the tokens and cost
  else if (frame.type === FrameType.Error) throw new TurnError(frame.code, frame.message);
}
chat.close();
```

Frames are read by one consumer at a time (`for await`, or `next()`, which
resolves `null` once the socket closed); sending works any time. A message
sent while a turn runs steers it. Closing the chat, or
`client.sessions.abort(id)`, cancels the running turn. `ask` rejects a
failed turn with a `TurnError` and its `code` (`PROVIDER_ERROR`,
`SESSION_QUEUE_FULL`, `ABORTED`, …).

The token travels in the `Sec-WebSocket-Protocol` header as
`bearer.<token>`, beside the `zeroclaw.v1` subprotocol: the WebSocket API
cannot send an `Authorization` header, and the gateway accepts either. The
same API hides the handshake's status, so after a refused connection the
client asks `GET /api/status` with the same token: a bad token is then the
`ApiError` (401) that call got, so `isUnauthorized` works. Any other refusal
(an unknown agent) is a `WebSocketError`.

## One-shot: webhook and A2A

`client.webhook.send(message, options)` posts to `/webhook` and returns the
agent's reply in one HTTP call. Its options carry the `agent`, the `secret`
(`X-Webhook-Secret`) when the gateway sets one, an `idempotencyKey` (a
repeat answers `{ duplicate: true }` without running again) and a
`sessionId` to keep calls in one conversation.

`client.webhook.a2aSend(alias, text)` does the same over the A2A protocol
(`message/send`) for agents published with `a2a.server.enabled`.
