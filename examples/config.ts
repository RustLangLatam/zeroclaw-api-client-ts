// Reads configuration fields, lists the agents and applies an atomic patch
// that only goes through if nothing changed in between.
//
//   ZEROCLAW_URL=… ZEROCLAW_TOKEN=… node examples/config.ts helper gpt-5.4-mini

import { ApiError, Client, PatchOps } from "zeroclaw-api-client";

const [agent, model] = process.argv.slice(2);
const client = new Client(process.env.ZEROCLAW_URL ?? "http://127.0.0.1:42617", {
  token: process.env.ZEROCLAW_TOKEN,
});

console.log("port:", (await client.config.get("gateway.port")).value);
console.log("agents:", (await client.config.mapKeys("agents")).join(", "));

if (agent && model) {
  const path = `agents.${agent}.model`;
  const current = (await client.config.get(path)).value;
  try {
    await client.config.patch([PatchOps.test(path, current), PatchOps.replace(path, model)]);
    console.log(`${path}: ${String(current)} -> ${model}`);
  } catch (err) {
    if (err instanceof ApiError) console.error(`refused (${err.status}): ${err.reason}`);
    else throw err;
  }
}
