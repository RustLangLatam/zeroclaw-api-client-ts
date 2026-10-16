# Timeouts and retries

## Timeouts

`timeout` (milliseconds, default 60 000) bounds how long a request waits for
the gateway's answer, after which it rejects with a `RequestTimeoutError`
and its `fetch` is aborted. It bounds the headers only, so a streamed body
(the event stream) is never cut. `null` waits without limit. A manual cron
run waits up to 660 s, as the gateway allows it 600. The same timeout bounds
the WebSocket handshake of a chat or a feed.

## Retries

Idempotent requests (GET, HEAD, OPTIONS, PUT, DELETE) are tried again after
a connection failure, a timeout, or a "try again" status (408, 429, 502,
503, 504), so a gateway that restarts does not fail a read. A POST or PATCH
is never retried: it could apply twice.

```ts
const client = new Client(url, {
  token,
  timeout: 10_000,
  retry: { maxRetries: 5, baseDelay: 250, maxDelay: 10_000, jitter: true },
});
```

The wait before retry `n` is `baseDelay * 2 ** n`, capped at `maxDelay`;
with `jitter`, a random point in its upper half, so clients that failed
together do not retry together. A `Retry-After` on a 429 or 503 is honored
up to `maxDelay`. `retry: false` turns retries off.

## Your own `fetch`

The `fetch` option replaces the function every request goes through: wrap
the global one to log, trace, sign requests or limit concurrency, or pass a
mock in tests.

```ts
const client = new Client(url, {
  token,
  fetch: async (input, init) => {
    const started = performance.now();
    try {
      return await fetch(input, init);
    } finally {
      metrics.observe(performance.now() - started);
    }
  },
});
```

Each try of a retried request goes through it. Rate limiting and circuit
breaking, built into the Python client, are left to such a wrapper here.
