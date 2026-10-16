# Guides

Each guide covers one area of the gateway and the module that calls it:

| Guide | Module | Property |
|---|---|---|
| [Configuration](./configuration.md) | `config.ts` | `client.config` |
| [Agents, personality and skills](./agents.md) | `agents.ts`, `skills.ts`, `files.ts` | `client.agent(alias)`, `client.skills`, `client.files` |
| [Channels](./channels.md) | `channels.ts` | `client.channels` |
| [Chatting with an agent](./chat.md) | `chat.ts`, `webhook.ts` | `await client.chat(alias, …)`, `client.webhook` |
| [Sessions and live events](./events.md) | `sessions.ts`, `events.ts` | `client.sessions`, `client.events` |
| [Cron, memory and cost](./operations.md) | `cron.ts`, `memory.ts`, `cost.ts`, `system.ts` | `client.cron`, `client.memory`, `client.cost`, `client.system` |
| [SOPs](./sops.md) | `sops.ts`, `canvas.ts`, `quickstart.ts` | `client.sops`, `client.canvas`, `client.quickstart` |
| [Browsers](./browsers.md) | — | — |
| [Timeouts and retries](./resilience.md) | `client.ts` | `new Client(url, options)` |
| [Errors](./errors.md) | `errors.ts` | — |

Pairing is covered in [Getting Started](../getting-started/pairing.md);
WebAuthn (`client.webauthn`) only carries the JSON of a hardware-key
ceremony run elsewhere (`navigator.credentials` in a browser).

The snippets assume a `client: Client` at hand; names come from
`zeroclaw-api-client`.
