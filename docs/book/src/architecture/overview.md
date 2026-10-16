# Architecture

The package is one ES module, `zeroclaw-api-client`, built from one source
file per area of the gateway under `src/`. Everything public is exported
from `src/index.ts`.

## The client

`Client` (`client.ts`) holds the base URL, the bearer token and its options
(`token`, `timeout`, `retry`, `fetch`, `WebSocket`). It holds no connection:
`fetch` pools them, so a client needs no closing and is safe to share.
`withToken` returns a client with the same options and another token.

All HTTP goes through a few helpers in `client.ts`, marked `@internal` and
left out of the published types:

- `_url(segments, query)` appends **path segments**, each percent-encoded,
  to the base URL. Ids are never formatted into a path string, so an id
  holding `/` or `?` stays one segment;
- `_send` attaches the bearer token and the JSON body, bounds the wait for
  the answer's headers with an `AbortController`, retries idempotent
  requests, and turns a non-success status into an `ApiError` that keeps
  the gateway's message and JSON body;
- `_json`, `_text`, `_empty` and `_field` (which unwraps single-field
  envelopes) read the answer.

## Resource properties

Each module defines a small class holding the client (`ConfigApi`,
`ChannelsApi`, …) whose methods are the endpoints, and `Client` exposes it
as a property (`client.config`, `client.channels`, …).
`client.agent(alias)` also carries the agent alias. A method's doc comment
opens with the route it calls, which the
[endpoint map](../reference/endpoints.md) is generated from.

## Streams

Two kinds of live data are read by the caller, one value at a time (the
client starts no background work for them):

- **Server-Sent Events** (`client.events.subscribe()`): `events.ts` reads
  `fetch`'s body through a `TextDecoderStream`, splits it into frames and
  decodes their JSON; `EventStream` is an async iterable, and `next()`
  resolves `null` at the end. `EventSource` is not used: it cannot send the
  token;
- **WebSockets** (`chat.ts`, on the standard `WebSocket`): a socket is opened
  with ZeroClaw's `zeroclaw.v1` subprotocol and the token as
  `bearer.<token>`, the one way a browser can authenticate a WebSocket. The
  chat reads typed `ChatFrame`s (`for await (const frame of chat)`); the
  canvas and SOP-run feeds are `Feed`s of JSON frames.

## Types

Response types are TypeScript interfaces that mirror the gateway's
serialized structs and `json!` literals, field for field, with the gateway's
snake_case names, and name the handler in their module comment. Nothing
validates them at run time
([ADR-004](./decisions/ADR-004-types-describe-the-wire.md)); the captured
response vectors check them at compile time. Shapes that are dynamic or
versioned with ZeroClaw stay `unknown`
([ADR-002](./decisions/ADR-002-dynamic-shapes-stay-json.md)). Method names
and parameters are camelCase, as TypeScript code expects.
