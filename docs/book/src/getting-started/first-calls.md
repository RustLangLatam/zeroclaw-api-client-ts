# First calls

```ts
import { Client } from "zeroclaw-api-client";

const client = new Client("http://127.0.0.1:42617", {
  token: process.env.ZEROCLAW_TOKEN,
});

// Public: no token needed.
const health = await client.system.health();
console.log(health.status);

// Version, model, channels and process figures.
const status = await client.system.status();
console.log(status.version, status.model);

// Every configured channel and its state.
for (const channel of await client.channels.list()) {
  console.log(channel.name, channel.status, channel.health);
}

// One configuration field.
const port = await client.config.get("gateway.port");
console.log(port.value);
```

A `Client` holds no connection of its own (`fetch` pools them), so it needs
no closing: make one per gateway and share it. Chats, feeds and event
streams are connections: close them when done.

## Timeouts and retries

A request waits 60 seconds for the gateway's answer unless the `timeout`
option (milliseconds) says otherwise; a manual cron run waits up to 660 s,
as the gateway allows it 600. The timeout bounds the answer's headers only,
so the live event stream is never cut. Failed idempotent requests are
retried three times with backoff. See [Timeouts and retries](../guides/resilience.md).

## Examples

The repository ships runnable scripts under `examples/`:

| Example | Shows |
|---|---|
| `status.ts` | version, model and channels |
| `pairing.ts` | exchanging a pairing code for a token |
| `config.ts` | reading fields, listing agents, an atomic patch |
| `events.ts` | following the live event stream, reconnecting |
| `chat.ts` | streaming an agent's reply over the WebSocket |

```sh
npm run build
ZEROCLAW_URL=http://127.0.0.1:42617 ZEROCLAW_TOKEN=zc_… \
  node --experimental-strip-types examples/status.ts
ZEROCLAW_URL=… ZEROCLAW_TOKEN=… node --experimental-strip-types examples/chat.ts helper "Hello"
```

(Node 23.6+ strips the types without the flag; `npx tsx examples/…` works on
any Node.)
