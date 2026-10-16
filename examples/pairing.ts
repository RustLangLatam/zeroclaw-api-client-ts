// Exchanges a pairing code for a bearer token and checks it works.
//
//   ZEROCLAW_URL=http://127.0.0.1:42617 node examples/pairing.ts 123456

import { Client } from "zeroclaw-api-client";

const code = process.argv[2];
if (!code) throw new Error("usage: pairing.ts <six-digit code>");

const anonymous = new Client(process.env.ZEROCLAW_URL ?? "http://127.0.0.1:42617");
const paired = await anonymous.pairing.pair(code, "example", "script");
const client = anonymous.withToken(paired.token);
const devices = await client.pairing.devices();
console.log(`paired; the gateway knows ${devices.length} device(s)`);
console.log("store this token as a secret:", paired.token);
