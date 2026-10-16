---
id: ADR-003
title: Web platform APIs, no runtime dependencies
date: 2026-10-16
status: accepted
relates-to:
  - package.json
  - src/client.ts
---

# ADR-003: Web Platform APIs, No Runtime Dependencies

## Context

The client is meant for browsers (in any framework) as much as for servers.
Every runtime it targets now ships `fetch`, `AbortController`, web streams,
`TextDecoderStream` and, except Node before 22, `WebSocket`. HTTP libraries
such as axios, or a WebSocket package, would add weight to every browser
bundle and differ between platforms.

## Decision

The client uses only those standard APIs and has no runtime dependencies.
Retries, backoff and timeouts are a few dozen lines in `client.ts`. What a
platform lacks, the caller passes in: a `WebSocket` constructor on old Node,
or a wrapped `fetch` for logging, tracing, signing, rate limiting or circuit
breaking. The package is an ES module only, compiled by `tsc` without a
bundler, with type declarations. The floor is Node 18 (the first with a
global `fetch`) and TypeScript 5 for its types; CI tests Node 20, 22 and 24.

## Consequences

- Installing the client adds nothing else to an application.
- No built-in rate limit or circuit breaker, unlike the Python client;
  callers who need them wrap `fetch`.
- CommonJS callers load it with `import()` (or Node's `require` of ES
  modules, from 22.12).
