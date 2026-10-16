# ZeroClaw API Client

`zeroclaw-api-client` is a typed TypeScript client for the
[ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) gateway: the HTTP and
WebSocket surface a ZeroClaw daemon exposes for its dashboard, its CLI and
third-party tooling. It is the TypeScript port of
[zeroclaw-api-client-rust](https://github.com/RustLangLatam/zeroclaw-api-client-rust),
[zeroclaw-api-client-go](https://github.com/RustLangLatam/zeroclaw-api-client-go)
and [zeroclaw-api-client-python](https://github.com/RustLangLatam/zeroclaw-api-client-python),
and covers the same routes.

It is built on the web platform (`fetch`, `WebSocket`, streams), so the same
package runs in browsers (React, Angular, Vue, Svelte or none), Node 18+,
Deno, Bun and edge runtimes, with no runtime dependencies.

With it an application can do everything the gateway allows a client to do:

- read and change the configuration, one field at a time or in atomic
  batches, including agents, providers and channels;
- pair new clients and manage the paired devices;
- see channels and their health, and manage who may talk to them;
- chat with an agent, streaming its reply, tool calls and approval requests;
- follow the live event stream and read session transcripts;
- schedule cron jobs, store and recall memory, and read usage and cost;
- edit agent workspaces, personality files, skills and SOPs, and run SOPs;
- check health, run diagnostics, read logs and upgrade the daemon.

It is a library: it never prints, logs or starts work that outlives a call.
Every call returns a typed result or throws a typed [error](./guides/errors.md)
carrying the gateway's own explanation.

This is an independent, community-maintained client. It is not affiliated
with or endorsed by ZeroClaw Labs.

## How it is organized

A [`Client`](./architecture/overview.md) holds the gateway URL and the bearer
token. Each group of endpoints is reached through a property, so call sites
read like the gateway's routes:

```ts
import { Client } from "zeroclaw-api-client";

const client = new Client("http://127.0.0.1:42617", { token: "zc_…" });
const channels = await client.channels.list();
await client.config.set("agents.helper.model", "gpt-5.4-mini");
const chat = await client.chat("helper");
const reply = await chat.ask("Hi");
chat.close();
console.log(channels.length, reply.full_response);
```

Every call returns a promise, and a failure rejects with a `ZeroClawError`.
Start with [Getting Started](./getting-started/index.md). The
[endpoint map](./reference/endpoints.md) lists every route and the method
that calls it.
