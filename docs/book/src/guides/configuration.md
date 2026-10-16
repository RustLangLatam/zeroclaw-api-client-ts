# Configuration

Everything ZeroClaw does is driven by its configuration (`config.toml`), and
the gateway exposes it field by field. Paths are dotted:
`providers.models.openai.default.api_key`, `agents.helper.model`,
`channels.whatsapp.main.allowed_groups`.

## Reading

- `client.config.get(path)` returns a `PropValue`: `value` holds the field's
  display value as decoded JSON, or, for a secret (`isSecret(prop)`), only
  `populated` says whether it is set; its value is never returned.
  `warnings` lists validation problems.
- `client.config.list(prefix)` enumerates every field under a prefix with
  its kind (`string`, `bool`, `integer`, `enum`, `alias-ref`, …), category,
  current value and whether an environment variable overrides it.
- `client.config.snapshot()` returns the whole configuration with secrets
  masked. It exists for compatibility; prefer the two calls above.
- `client.config.schema()` and `client.config.propSchema(path)` return the
  JSON Schema (public, static per gateway build).

## Writing

- `client.config.set(path, value, comment?)` writes one field. `value` is
  anything JSON can encode; the gateway coerces it to the field's kind and
  refuses a mismatch with 400 `value_type_mismatch`. A map alias the path
  implies is created (`agents.new_agent.model` creates `agents.new_agent`).
  A `comment` is written above the key.
- `client.config.reset(path)` resets a field to its default.
- `client.config.patch(ops, overrideDrift?)` applies several operations at
  once, all or nothing:

```ts
import { PatchOps } from "zeroclaw-api-client";

await client.config.patch([
  PatchOps.test("agents.helper.model", "gpt-5.4-mini"),
  PatchOps.replace("agents.helper.model", "gpt-5.5"),
  PatchOps.comment("agents.helper.model", "upgraded by the billing service"),
]);
```

`PatchOps.add` and `PatchOps.remove` complete the set. If a patched field
was edited on disk since the gateway loaded it, the patch is refused with
409 `config_changed_externally`; `client.config.drift()` shows what
differs, and `overrideDrift = true` overwrites it.

## Aliases: agents, providers, channels

Agents and other named entries are map aliases:

- `mapKeys("agents")` lists them;
- `createMapKey("agents", "helper")` creates one with defaults;
- `renameMapKey("agents", "helper", "assistant")` renames it and every
  reference to it (and moves an agent's workspace, memory, cron jobs and
  sessions);
- `deletePlan("agents", "helper")` shows what a delete would block on or
  rewrite, and `deleteMapKey` does it. Deleting an agent archives its
  workspace and exports its memory first.

`aliasValues("model_providers")` lists the values an alias reference may
take, and `agentOptions()` everything an agent can point to.

## Applying changes

Most writes take effect at once. Some subsystems pick changes up only on a
daemon reload: `client.config.pendingReload()` says whether one is due, and
`client.system.reload()` performs it (the connection drops briefly).

## Setup sections and catalogs

`sections()`, `sectionItems(section)` and
`selectSectionItem(section, key, alias)` drive the same setup flow as the
dashboard. `catalog()` and `catalogModels(provider)` list the known model
providers and their models (the latter may call the provider with the
configured key). `refreshContextWindow(providerType, alias)` stores a
model's context window as the provider reports it.
