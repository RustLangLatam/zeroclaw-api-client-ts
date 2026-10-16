// Read-only calls against a running gateway, when one is given:
//
//   ZEROCLAW_URL=http://127.0.0.1:42617 ZEROCLAW_TOKEN=zc_… npm test
//
// Each call must answer and fit its type; routes a build may lack (404) are
// reported, not failed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, isNotFound } from "../src/index.js";

const url = process.env.ZEROCLAW_URL;
const token = process.env.ZEROCLAW_TOKEN;
const skip = url && token ? false : "set ZEROCLAW_URL and ZEROCLAW_TOKEN to run";

test("live: every read-only call answers", { skip }, async () => {
  const client = new Client(url ?? "", { token });
  const calls: Record<string, () => Promise<unknown>> = {
    health: () => client.system.health(),
    runtimeHealth: () => client.system.runtimeHealth(),
    status: () => client.system.status(),
    tools: () => client.system.tools(),
    integrations: () => client.system.integrations(),
    integrationSettings: () => client.system.integrationSettings(),
    tuis: () => client.system.tuis(),
    logs: () => client.system.logs({ limit: 5 }),
    channels: () => client.channels.list(),
    configList: () => client.config.list("gateway"),
    configStatus: () => client.config.status(),
    configSections: () => client.config.sections(),
    agentOptions: () => client.config.agentOptions(),
    drift: () => client.config.drift(),
    cron: () => client.cron.list(),
    cronSettings: () => client.cron.settings(),
    cost: () => client.cost.summary(),
    sessions: () => client.sessions.list(),
    eventsHistory: () => client.events.history(),
    devices: () => client.pairing.devices(),
    memory: () => client.memory.search(),
    skillBundles: () => client.skills.bundles(),
    canvases: () => client.canvas.list(),
    quickstartState: () => client.quickstart.state(),
    files: () => client.files.list(),
  };
  const failures: string[] = [];
  for (const [name, call] of Object.entries(calls)) {
    try {
      await call();
      console.error(`ok      ${name}`);
    } catch (err) {
      if (isNotFound(err)) console.error(`absent  ${name}`);
      else failures.push(`${name}: ${(err as Error).message}`);
    }
  }
  assert.deepEqual(failures, []);
});
