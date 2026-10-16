# zeroclaw-api-client — next release

Changes since the start. They become the release notes of the next version.

## What's New

- The first release of the TypeScript client for the official ZeroClaw
  0.8.5 gateway: every route its siblings in Rust, Go and Python cover
  (configuration, pairing and devices, channels, agents' workspaces,
  personality and skills, sessions, the live event stream, the WebSocket
  chat and feeds, cron, memory, cost, SOPs, canvases, the quickstart,
  WebAuthn, the webhook and A2A, health, logs and upgrades).
- Built on `fetch`, `WebSocket` and web streams, with no runtime
  dependencies: it runs in browsers, Node 18+, Deno, Bun and edge runtimes.
- Timeouts on the answer's headers, retries of idempotent calls with
  backoff and `Retry-After`, and typed errors carrying the gateway's
  explanation.

## Breaking Changes

None.
