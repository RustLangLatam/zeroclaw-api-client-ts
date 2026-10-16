# Cron, memory and cost

## Cron jobs

A job runs a shell command or an agent prompt on a schedule and can deliver
its output to a channel:

```ts
import { announce } from "zeroclaw-api-client";

const job = await client.cron.create({
  agent: "helper",
  schedule: "0 9 * * 1-5",
  tz: "Europe/Madrid",
  prompt: "Summarize yesterday's orders",
  delivery: announce("whatsapp.main", "+34600000000"),
});
const result = await client.cron.run(job.id); // runs it now and waits
console.log(result.success, result.output);
```

`update` changes a job (pause with `{ enabled: false }`), `runs` lists its
history, and `settings` / `updateSettings` cover the scheduler. Fields left
unset are not sent.

## Memory

`client.memory.search({ query, category, since, until, agent })` recalls
entries by text or time (at most 50), or lists a category; `store` and
`forget` write. Each agent can have its own memory (`agent`) besides the
shared one.

## Cost

`client.cost.summary(from, to)` returns tokens, calls and USD in a window,
by model and by agent; `client.cost.agent(alias)` an agent's session and
daily figures. Models without known rates count as free unless their prices
are configured.

## The gateway itself

`client.system` covers health (`health`, public), `status`, Prometheus
`metrics`, `doctor`, `tools`, `integrations`, host `cliTools`, connected
terminal clients (`tuis`), paged structured `logs`, version checks
(`versionCheck`) and self-upgrades (`upgrade`, `upgradeStatus`), and the
daemon's `reload` and `shutdown`.
