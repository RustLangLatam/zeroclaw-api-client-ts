# Browsers

The client uses only web platform APIs, so it runs in any browser app
(React, Angular, Vue, Svelte, or plain scripts) as it does on a server. Two
things about the gateway decide how.

## The gateway sends no CORS headers

ZeroClaw's gateway has no CORS layer: a page served from another origin
cannot read its answers, and the browser reports the call as a network
failure (a `TransportError`). Either:

- serve the page from the gateway's origin, behind a reverse proxy that
  routes `/api`, `/ws`, `/health` and the other gateway paths to it; or
- put a proxy in front of the gateway that answers preflight requests and
  adds `Access-Control-Allow-Origin` (for your origin only),
  `Access-Control-Allow-Headers: Authorization, Content-Type,
  X-Idempotency-Key, X-Webhook-Secret, X-Session-Id,
  X-ZeroClaw-Override-Drift, X-Pairing-Code` and the methods you use.

WebSockets are not subject to CORS; the chat and feeds connect from any
origin the network allows.

## The token is an operator credential

A paired token can do anything the gateway allows: change the configuration,
read every session, run commands through cron. Whoever loads a page that
holds it can read it. So the client belongs in pages for the gateway's own
operators (an internal dashboard, a setup tool), not in an app for end users.
An end-user app talks to a backend of its own, which keeps the token and
decides what each user may do, and that backend uses this client (or a
sibling) server-side.

## In frameworks

The client is promise-based and has no framework bindings. Create one
`Client` per gateway (a module-level value, a React context, an Angular
injectable) and call it from effects or services; a `for await` over a chat
or an event stream belongs in an effect that closes the stream on cleanup:

```ts
useEffect(() => {
  let stream: EventStream | undefined;
  let stopped = false;
  (async () => {
    stream = await client.events.subscribe();
    if (stopped) return stream.close();
    for await (const event of stream) setEvents((all) => [...all.slice(-99), event]);
  })();
  return () => {
    stopped = true;
    void stream?.close();
  };
}, [client]);
```

Angular code can wrap a call in `from(promise)`, or a stream in an
`Observable` whose teardown closes it.
