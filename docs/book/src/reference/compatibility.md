# Compatibility

## ZeroClaw versions

This unreleased branch targets the patched ZeroClaw build `0.8.5+unified.18`,
whose router (its routes are in `scripts/gateway-routes.txt`) is the
[source of truth](../architecture/decisions/ADR-001-gateway-is-the-source-of-truth.md)
for every request and response shape here. Releases, from `main`, cover only
the official ZeroClaw gateway.

Against an official ZeroClaw 0.8.5 build everything works except these
routes, which only the patched build has (upstream declined them in
[#11434](https://github.com/zeroclaw-labs/zeroclaw/issues/11434)); official
ZeroClaw answers them with its web UI fallback or 404. They leave this
branch once official ZeroClaw adopts them:

| Route | Method |
|---|---|
| `POST /api/channels/{channel}/send` | `channels.send` |
| `GET /api/channels/{channel}/rooms` | `channels.rooms` |
| `POST /api/channels/{channel}/rooms` | `channels.createRoom` |
| `GET /api/channels/{channel}/rooms/{room}/members` | `channels.roomMembers` |
| `POST /api/channels/{channel}/rooms/{room}/invites` | `channels.invite` |
| `DELETE /api/channels/{channel}/rooms/{room}/members/{user}` | `channels.removeMember` |
| `POST /api/channels/{channel}/messages/{message_id}/redeliver` | `channels.redeliver` |

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
