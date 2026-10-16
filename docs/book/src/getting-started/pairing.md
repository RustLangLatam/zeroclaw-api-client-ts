# Connecting and pairing

A ZeroClaw gateway with pairing on (the default) answers only clients that
send a paired bearer token: `Authorization: Bearer zc_<64 hex>`. A client
gets one by exchanging a six-digit pairing code, which is single use and
valid for ten minutes.

## Getting a code

- **First run:** the daemon prints a code when it starts and no client is
  paired yet; `client.pairing.initialCode()` also returns it until the
  first pairing.
- **From a paired client:** `client.pairing.newCode()` mints one for another
  device.
- **On the gateway host:** `client.pairing.adminCode()` and
  `client.pairing.adminNewCode(rotate)` (loopback only); `rotate` can also
  revoke every token (`"all"`) or one device's.

## Exchanging it

```ts
const anonymous = new Client("http://127.0.0.1:42617");
const paired = await anonymous.pairing.pair("123456", "billing-service", "server");
// Store paired.token as a secret; it is shown only once.
const client = anonymous.withToken(paired.token);
```

`withToken` returns a client for the same gateway and options. A wrong or
expired code is refused with 400; too many attempts are rate-limited with
429 (`isRateLimited(err)`), with a `retry_after` field in the error body
(`ApiError.body`).

## Managing devices

`client.pairing.devices()` lists the paired devices, `revokeDevice(id)`
revokes one and its token, and `rotateDeviceToken(id)` revokes it and mints
a code for it to pair again.

## Keeping the token safe

The client never shows its token: `String(client)` and
`JSON.stringify(client)` give only the base URL and whether it is
authenticated, and the token never appears in an error or a URL. On the
WebSocket it travels in the `Sec-WebSocket-Protocol` header, not in the
query string. The token is an operator credential for the whole gateway:
see [Browsers](../guides/browsers.md) before putting one in a web page.
