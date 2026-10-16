// Follows the live event stream, reconnecting when the gateway restarts.
// Stop with Ctrl-C.
//
//   ZEROCLAW_URL=… ZEROCLAW_TOKEN=… node examples/events.ts

import {
  Client,
  DecodeError,
  type EventStream,
  eventKind,
  isLogEvent,
  isTransient,
} from "zeroclaw-api-client";

async function follow(events: EventStream): Promise<void> {
  for (;;) {
    let event: Awaited<ReturnType<EventStream["next"]>>;
    try {
      event = await events.next();
    } catch (err) {
      if (err instanceof DecodeError) continue; // one bad frame; the stream goes on
      throw err;
    }
    if (event === null) return;
    const kind = eventKind(event);
    if (kind === "agent_end")
      console.log(`turn    ${event.agent_alias} ${event.tokens_used} tokens`);
    else if (kind === "tool_call") console.log(`tool    ${event.tool} ok=${event.success}`);
    else if (kind === "cron_result") console.log(`cron    ${event.job_id} ok=${event.success}`);
    else if (kind) console.log(`${kind.padEnd(7)} ${JSON.stringify(event)}`);
    else if (isLogEvent(event)) console.log(`log     ${event.message}`);
  }
}

const client = new Client(process.env.ZEROCLAW_URL ?? "http://127.0.0.1:42617", {
  token: process.env.ZEROCLAW_TOKEN,
});

for (;;) {
  let events: EventStream;
  try {
    events = await client.events.subscribe();
  } catch (err) {
    if (!isTransient(err)) throw err;
    console.log(`gateway unavailable (${(err as Error).message}); retrying`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    continue;
  }
  try {
    await follow(events);
  } finally {
    await events.close();
  }
  console.log("stream closed; reconnecting");
}
