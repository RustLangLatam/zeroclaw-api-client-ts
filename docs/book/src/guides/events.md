# Sessions and live events

## Sessions

Every conversation is a session: web chats are `gw_<id>`, channel
conversations `whatsapp_<channel>_<peer>…`. `client.sessions.list()` returns
them with their agent and channel; `messages(id)` the transcript (tool calls
and results included, as JSON text); `state(id)` whether a turn is running;
`running()` only the gateway's own (web chat) sessions.

`addMessage(id, content)` appends an assistant message (shown to chat
clients, with no agent turn); `rename`, `abort` and `delete` do what they
say.

## The live event stream

`await client.events.subscribe()` follows `/api/events`, the gateway's
Server-Sent Events stream. Read it with `for await`, or with `next()` until
it resolves `null`:

```ts
import { DecodeError, eventKind, isLogEvent } from "zeroclaw-api-client";

const events = await client.events.subscribe();
for (;;) {
  let event;
  try {
    event = await events.next();
  } catch (err) {
    if (err instanceof DecodeError) continue; // a frame that is not JSON; the stream goes on
    throw err;
  }
  if (event === null) break; // the gateway closed it: subscribe again
  if (eventKind(event) === "agent_end") console.log("turn cost", event.cost_usd);
  else if (isLogEvent(event)) console.log("log", event.event);
}
```

An event is a plain object of the frame's top-level fields, decoded from
JSON. Frames have no SSE event name; `eventKind` reads their `type`.
Observer events (`llm_request`, `tool_call`, `tool_call_start`,
`agent_start`, `agent_end`, `error`, `history_trimmed`) carry
`source: "observability"`; log events carry `@timestamp` instead of a
`type`. The stream ends when the gateway closes it (on reload, for
instance): subscribe again; `examples/events.ts` shows the loop.
`client.events.history()` returns the latest observer events, kept in
memory.

The stream is read from `fetch`'s body rather than with `EventSource`, which
cannot send the bearer token. The client's timeout bounds only the wait for
it to open; `close()` ends it.
