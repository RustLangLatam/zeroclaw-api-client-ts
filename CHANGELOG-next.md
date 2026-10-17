# zeroclaw-api-client — next release

Changes since v0.1.1. They become the release notes of the next version.

## What's New

- A chat or feed handshake refused for the token is now an `ApiError` 401 (or 403),
  so `statusCode` and `isUnauthorized` work on it. The WebSocket API hides the
  handshake's status, so the client checks the token on `GET /api/status` after a
  refusal. Before, it was a `WebSocketError` naming only the close code (1006).

## Breaking Changes

None.
