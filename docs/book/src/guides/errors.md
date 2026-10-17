# Errors

Every failure rejects with a `ZeroClawError` subclass. Check the class you
care about with `instanceof`:

| Error | When |
|---|---|
| `ApiError` (`status`, `reason`, `body`) | The gateway answered with a non-success status. `reason` is its explanation (the `error` or `message` field, or the body text); `body` keeps the JSON error body, decoded. Its `message` reads `gateway answered <status>: <reason>`. |
| `TransportError` | No HTTP answer: connection refused, DNS or TLS failure, a broken connection, or a CORS refusal in a browser. Its `cause` is the `fetch` error. |
| `RequestTimeoutError` | The gateway did not answer in time, after any retries. |
| `DecodeError` | A successful answer did not have the expected shape. |
| `WebSocketError` | A WebSocket failed, or its handshake was refused for a reason other than the token (a refused token is an `ApiError` 401). |
| `TurnError` (`code`) | A chat turn ended in an `error` frame, or was aborted (`ABORTED`). |
| `InvalidUrlError` | The base URL is not an absolute `http`/`https` URL (thrown by the constructor). |

`statusCode(err)`, `isNotFound(err)`, `isUnauthorized(err)` (401 and 403),
`isRateLimited(err)` (429) and `isTransient(err)` (no connection, a
timeout, or 408, 429, 502, 503, 504: worth trying again later) answer the
usual questions on any thrown value. Idempotent calls were already retried
before a transient error reaches you; see [Timeouts and retries](./resilience.md).

## The gateway's error bodies

The gateway does not use one error shape, and the client reads all of them
into `reason`:

- `{"error": "…"}`, most routes, sometimes with `retry_after` (seconds) on
  429;
- `{"code": "…", "message": "…", "path": "…", "op_index": n}` on
  configuration routes (`path_not_found`, `value_type_mismatch`,
  `config_changed_externally`, …) and uploads;
- `{"channel": "…", "error": "…"}` on channel actions;
- plain text when the request is refused before its handler runs (a
  malformed body, a body over 64 KiB, the device endpoints' 401), and an
  empty body on the gateway's request timeout (408).

Read further fields from `body`:

```ts
import { ApiError } from "zeroclaw-api-client";

try {
  await client.config.set("gateway.port", "not a number");
} catch (err) {
  if (err instanceof ApiError && err.status === 400) {
    console.log((err.body as { code?: string }).code); // value_type_mismatch
  }
}
```
