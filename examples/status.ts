// The gateway's version, model and channels.
//
//   ZEROCLAW_URL=http://127.0.0.1:42617 ZEROCLAW_TOKEN=zc_… node examples/status.ts

import { Client } from "zeroclaw-api-client";

const client = new Client(process.env.ZEROCLAW_URL ?? "http://127.0.0.1:42617", {
  token: process.env.ZEROCLAW_TOKEN,
});

const health = await client.system.health();
console.log(`health  ${health.status} (paired: ${health.paired})`);

const status = await client.system.status();
console.log(`version ${status.version}, model ${status.model}, up ${status.uptime_seconds} s`);

for (const channel of await client.channels.list()) {
  console.log(`channel ${channel.name}: ${channel.status}, ${channel.health}`);
}
