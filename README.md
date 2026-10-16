<h1 align="center">zeroclaw-api-client-ts</h1>

<p align="center">
  <strong>Your ZeroClaw, from TypeScript. In the browser, on the server, with nothing else to install.</strong>
</p>

<p align="center">
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/RustLangLatam/zeroclaw-api-client-ts/ci.yml?branch=main&label=build" alt="Build Status" /></a>
  <a href="https://www.npmjs.com/package/zeroclaw-api-client"><img src="https://img.shields.io/npm/v/zeroclaw-api-client?label=npm" alt="npm" /></a>
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/LICENSE-APACHE"><img src="https://img.shields.io/badge/license-MIT%20OR%20Apache%202.0-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/types-strict-3178c6" alt="strict TypeScript" />
  <img src="https://img.shields.io/badge/dependencies-0-15803d" alt="no runtime dependencies" />
  <a href="https://github.com/zeroclaw-labs/zeroclaw"><img src="https://img.shields.io/badge/ZeroClaw-0.8.5-black" alt="ZeroClaw 0.8.5" /></a>
</p>

<p align="center">
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/introduction.md">Docs</a> ·
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/getting-started/index.md">Quick start</a> ·
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/guides/index.md">Guides</a> ·
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/guides/browsers.md">Browsers</a> ·
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/reference/endpoints.md">Endpoint map</a> ·
  <a href="https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/architecture/overview.md">Architecture</a> ·
  <a href="https://github.com/zeroclaw-labs/zeroclaw">ZeroClaw</a>
</p>

---

`zeroclaw-api-client` is a typed TypeScript client for the
[ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) gateway: its HTTP API,
its Server-Sent Events stream and its WebSocket chat. It runs wherever
`fetch` does: browsers (React, Angular, Vue, Svelte or plain scripts),
Node 18+, Deno, Bun and edge runtimes.

> An independent, community-maintained client. It is not affiliated with or
> endorsed by ZeroClaw Labs; ZeroClaw is a trademark of ZeroClaw Labs.

```sh
npm install zeroclaw-api-client
```

```ts
import { Client } from "zeroclaw-api-client";

const client = new Client("http://127.0.0.1:42617", { token: "zc_…" });

const status = await client.system.status();
const channels = await client.channels.list();
await client.config.set("agents.helper.model", "gpt-5.4-mini");

const chat = await client.chat("helper");
const reply = await chat.ask("How many orders are pending?");
chat.close();

console.log(status.version, channels.length, reply.full_response);
```

## Why an SDK

ZeroClaw is a self-hosted AI agent runtime. Everything an operator can do
with it (configure agents, models and channels, pair devices, run SOPs,
schedule jobs, read sessions and costs, talk to an agent) is exposed by its
gateway over HTTP and WebSockets. Calling that surface by hand from every
application that embeds ZeroClaw means repeating, in each of them:

- **the contract**: about 150 routes, a dozen response shapes for errors, a
  JSON Patch dialect for the configuration, an event stream whose frames have
  no names, a chat protocol with typed frames;
- **the edge cases**: secrets that are never returned, paths that must be
  encoded segment by segment, a gateway that drops connections while it
  reloads, routes that only exist with some build features, a WebSocket that
  browsers can only authenticate through its subprotocol;
- **the resilience**: timeouts that must not cut a stream, retries that must
  never repeat a write.

This package does it once, typed and tested, so applications talk to
ZeroClaw in terms of channels, agents and sessions instead of URLs and JSON.

## Features

- **The whole client surface** of the gateway, one property per area:

  | Property | Covers |
  |---|---|
  | `config` | per-field reads and writes, atomic JSON Patch, map aliases (agents, providers, channels), drift, catalogs, setup sections |
  | `pairing` | pairing codes, bearer tokens, paired devices |
  | `channels` | channel state, identity binding, relinking |
  | `chat()` | agent chat over WebSocket: streamed replies, tool calls, tool approvals |
  | `sessions`, `events` | transcripts, session state, the live Server-Sent Events stream |
  | `agent()`, `files`, `skills` | agent workspaces, personality files, shared files, image uploads, skill bundles |
  | `cron`, `memory`, `cost` | scheduled jobs, long-term memory, usage and cost |
  | `sops`, `canvas`, `quickstart` | SOP authoring, runs and approvals; canvases; the first-agent setup |
  | `system` | health, status, metrics, diagnostics, tools, logs, upgrades, reload |
  | `webhook`, `webauthn` | one-shot webhook and A2A messages; hardware-key ceremonies |

- **Web platform only**: `fetch`, `WebSocket`, web streams and
  `AbortController`; no runtime dependencies, an ES module with its types.
- **Works in the browser**: the event stream is read from `fetch` (so it
  carries the token, unlike `EventSource`), and the chat authenticates
  through the WebSocket subprotocol, the one way a browser can.
- **Resilient by default**: answer timeouts that never cut a stream, and
  retries with jittered exponential backoff for idempotent calls only,
  honoring `Retry-After`. Pass your own `fetch` to add logging, tracing,
  signing or rate limiting around every request.
- **Typed end to end**: strict TypeScript, interfaces that mirror the
  gateway's JSON field for field, checked at compile time against answers
  captured from a real gateway.
- **Typed errors**: every failure is a `ZeroClawError`; a gateway refusal is
  an `ApiError` that keeps its status, its explanation and its JSON body;
  `isNotFound`, `isUnauthorized`, `isRateLimited` and `isTransient`
  classify any error.
- **Pull, not callbacks**: the event feed is an `EventStream`, the canvas and
  SOP-run feeds a `Feed`, and a chat a session you iterate with `for await`.
  The client starts no background work of its own.
- **Safe by construction**: every path segment is percent-encoded, the token
  never appears in `String(client)`, JSON or errors, nothing is logged.

## Browsers

The gateway sends no CORS headers and its token is an operator credential.
Use the client in pages for the gateway's own operators, served from the
gateway's origin or through a proxy that adds CORS headers; an end-user app
keeps the token in a backend of its own. See
[Browsers](https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/guides/browsers.md).

## Technologies

| Concern | Choice |
|---|---|
| Language | TypeScript (strict), compiled to ES2022 modules with `.d.ts` |
| HTTP | the platform's `fetch`, or yours |
| Timeouts and retries | `AbortController`; jittered exponential backoff, `Retry-After` |
| Event stream | `fetch` body through `TextDecoderStream` |
| WebSockets | the platform's `WebSocket`, or yours (`zeroclaw.v1` subprotocol, `bearer.<token>`) |
| Tests | `node:test` with a mock `fetch` gateway, a stand-in WebSocket, captured response vectors |
| Quality | [Biome](https://biomejs.dev/) (format and lint), `tsc` strict |
| Docs | TSDoc comments and an [mdBook](https://rust-lang.github.io/mdBook/) book |
| Supply chain | zero runtime dependencies, `npm audit`, a locked `package-lock.json`, npm provenance |

## Examples

Runnable scripts under [`examples/`](https://github.com/RustLangLatam/zeroclaw-api-client-ts/tree/main/examples):

| Example | Shows |
|---|---|
| `status.ts` | version, model and channels |
| `pairing.ts` | exchanging a pairing code for a token |
| `config.ts` | reading fields, listing agents, an atomic patch |
| `events.ts` | following the live event stream, reconnecting |
| `chat.ts` | streaming an agent's reply over the WebSocket |

```sh
npm run build
ZEROCLAW_URL=http://127.0.0.1:42617 ZEROCLAW_TOKEN=zc_… node examples/status.ts
```

(Node 23.6+ runs TypeScript directly; on older Node use
`--experimental-strip-types` or `npx tsx`.)

## Testing

- **Table-driven tests** for the logic: error mapping, URL encoding, SSE
  framing, chat frames, retries, backoff and timeouts.
- **HTTP-boundary tests** for every endpoint against a mock gateway: method,
  path, query, headers, body and result.
- **Response vectors**: answers captured from a real gateway (anonymized)
  must fit the client's types at compile time and come out of their calls
  unchanged.
- **A live test** of every read against a running gateway, when one is given.

```sh
npm ci && npm test
```

## Compatibility

Targets the official ZeroClaw **0.8.5** gateway; see
[Compatibility](https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/docs/book/src/reference/compatibility.md)
for the runtimes it supports and the routes that need a build feature.

## Other languages

The same client, with the same surface, behavior and tests:

| Language | Repository | Install |
|---|---|---|
| Rust | [zeroclaw-api-client-rust](https://github.com/RustLangLatam/zeroclaw-api-client-rust) | `cargo add zeroclaw-api-client` |
| Go | [zeroclaw-api-client-go](https://github.com/RustLangLatam/zeroclaw-api-client-go) | `go get github.com/RustLangLatam/zeroclaw-api-client-go` |
| Python | [zeroclaw-api-client-python](https://github.com/RustLangLatam/zeroclaw-api-client-python) | `pip install zeroclaw-api-client` |
| Kotlin | [zeroclaw-api-client-kotlin](https://github.com/RustLangLatam/zeroclaw-api-client-kotlin) | `implementation("com.github.RustLangLatam:zeroclaw-api-client-kotlin:v0.1.0")` (JitPack) |

## Contributing

Work happens on branches with pull requests to `main`; see
[CONTRIBUTING.md](https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/CONTRIBUTING.md)
and [AGENTS.md](https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/AGENTS.md).

## License

Licensed under either of [Apache License, Version 2.0](https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/LICENSE-APACHE)
or [MIT license](https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/LICENSE-MIT),
at your option.
