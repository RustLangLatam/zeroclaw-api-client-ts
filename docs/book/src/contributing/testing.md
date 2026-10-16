# Testing

Four layers of tests, each catching what the others cannot:

| Kind | Where | Catches |
|---|---|---|
| Table-driven | `tests/*.test.ts` | logic mistakes: parsing, mapping, retries |
| HTTP boundary | `tests/endpoints.test.ts`, against the mock gateway in `tests/helpers.ts` | wrong method, path, query, headers or body; what a call returns |
| Response vectors | `tests/vectors/*.json` + `tests/vectors.test.ts` | types that do not match what a real gateway sends (at compile time) |
| Live | `tests/live.test.ts`, skipped without a gateway | anything a real gateway does differently today |

The tests use Node's own runner (`node:test`) on the compiled output, so
they need nothing installed beyond TypeScript:

```sh
npm test
```

## The mock gateway

`tests/helpers.ts` builds a `Client` whose `fetch` records every request and
answers from a handler, with retries that do not wait; the WebSocket tests
pass a stand-in `WebSocket` whose test plays the gateway's side (opening,
pushing frames, closing).

## Response vectors

The vectors are the ones the Rust client captures from a real gateway with
its `scripts/capture-vectors.py` (anonymized: phone numbers, ids, UUIDs,
tokens, IPs and e-mails replaced; routes that hold people's words left
out). Each is `{"route", "build", "response"}`. `tests/vectors.test.ts`
assigns each response, or the envelope field the client unwraps, to the
client's type, so a mismatch fails the build; at run time it serves each
answer to the matching call and checks the result. Copy new vectors from
the Rust client and add a line for each.

## Live

`tests/live.test.ts` makes the read-only calls against a running gateway
when one is given, and fails on anything but success or a 404 (a route the
build lacks):

```sh
ZEROCLAW_URL=http://127.0.0.1:42617 ZEROCLAW_TOKEN=zc_… npm test
```

Writes are not exercised live; the mock gateway covers them.
