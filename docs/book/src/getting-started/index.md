# Getting Started

## Install

Add the package from npm:

```sh
npm install zeroclaw-api-client     # or: pnpm add / yarn add / bun add
```

and import what you need:

```ts
import { Client } from "zeroclaw-api-client";
```

It is an ES module with its type declarations. It needs `fetch`, streams
and `TextDecoderStream` (browsers, Node 18+, Deno, Bun) and, for the chat
and the live feeds, a `WebSocket`: global in browsers, Deno, Bun and Node
22+; on older Node pass one, such as the `ws` package's, as the client's
`WebSocket` option. It has no runtime dependencies
([why](../architecture/decisions/ADR-003-web-platform-no-dependencies.md)).

## What you need from the gateway

- **Its URL.** The gateway listens on `127.0.0.1:42617` by default. Behind a
  reverse proxy, or with `[gateway] path_prefix`, use the full base URL
  (`https://host/zeroclaw`): the client appends routes to it.
- **A bearer token**, unless the gateway runs with pairing off. Tokens come
  from pairing: see [Connecting and pairing](./pairing.md).
- **Remote admin rights**, only for `/admin/*` calls from another host:
  those need `[gateway] allow_remote_admin = true` and pairing on.
- **In a browser**, a page on the gateway's origin or a proxy that adds CORS
  headers: see [Browsers](../guides/browsers.md).

Then make your [first calls](./first-calls.md). The snippets in this book,
past the first calls, assume a `client: Client` at hand.
