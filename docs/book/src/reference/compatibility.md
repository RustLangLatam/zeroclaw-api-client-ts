# Compatibility

## ZeroClaw versions

The client targets the official ZeroClaw **0.8.5** gateway
([zeroclaw-labs/zeroclaw](https://github.com/zeroclaw-labs/zeroclaw), tag
`v0.8.5`), whose router (its routes are in `scripts/gateway-routes.txt`) is
the [source of truth](../architecture/decisions/ADR-001-gateway-is-the-source-of-truth.md)
for every request and response shape here. A route enters the client once
official ZeroClaw has it, or at least a pull request that adds it.

Some routes exist only when the gateway is built with a feature: WebAuthn
(`webauthn`) and A2A (`a2a`). Without it they answer 404.

Types describe the gateway's JSON and nothing checks them at run time
([ADR-004](../architecture/decisions/ADR-004-types-describe-the-wire.md)):
fields a gateway adds simply appear, and optional or newer fields are typed
optional, so a nearby build still works.

## Runtimes

| Runtime | Supported | Notes |
|---|---|---|
| Browsers | current Chrome, Edge, Firefox, Safari | see [Browsers](../guides/browsers.md) for CORS and the token |
| Node | 18 and newer | CI tests 20, 22 and 24. Node 18–21 have no global `WebSocket`: pass one (the `ws` package's) for the chat and feeds |
| Deno, Bun | current | |
| Edge runtimes | where `fetch` and streams exist | WebSockets depend on the platform |

The package is an ES module with type declarations. It is written in strict
TypeScript and needs TypeScript 5 or newer to read its types
([ADR-003](../architecture/decisions/ADR-003-web-platform-no-dependencies.md)).
