# Endpoint map

Every gateway route the client calls, with the module and method that call
it. The table is generated from the code: each public method's doc comment
starts with its route, and `scripts/endpoint-map.py` collects them.

Routes the client deliberately does not call:

- inbound webhooks (`/whatsapp`, `/linq/{alias}`, `/nextcloud-talk/{alias}`,
  `/webhook/gmail`, the coding-agent hook under `/hooks/`, and the SOP trigger ingress
  `/sop/{path}`): providers and external systems call them, not clients;
- `/api/plugins`, which only a `plugins-wasm` build has: not covered yet;
- the bundled web UI (`/_app/*`) and the HTML API explorer (`/api/docs`);
- the daemon's own protocols: `/acp` (zerocode) and `/ws/nodes` (nodes);
- aliases of routes the client calls: `/a2a/.well-known/agents-card.json`
  (same card as `/.well-known/agents-card.json`) and `GET /api/doctor` (same
  handler as `POST`);
- channel files, polls and delivery status (`POST /api/channels/{channel}/files`,
  `POST …/polls`, `GET …/messages/{id}`): not covered yet.

`scripts/route-drift.py` compares this table with the targeted gateway's
routes, kept in `scripts/gateway-routes.txt`; CI runs it. With a ZeroClaw
checkout as argument it first refreshes that list from the checkout's source.

Some routes only exist when the gateway is built with a Cargo feature; on a
build without it they answer 404 (`isNotFound(err)`):

| Gateway feature | Default | Client methods |
|---|---|---|
| `a2a` | on | `webhook.agentCard`, `agentCatalog`, `a2aSend` (also need `[a2a.server] enabled = true`) |
| `webauthn` | off | `webauthn` |
| `observability-prometheus` | on | `system.metrics` |
| `plugins-wasm` | off | not covered |

| Method | Path | Module | Function |
|---|---|---|---|
| `GET` | `/.well-known/agents-card.json` | `webhook` | `agentCatalog` |
| `POST` | `/a2a/{alias}` | `webhook` | `a2aSend` |
| `GET` | `/a2a/{alias}/.well-known/agent-card.json` | `webhook` | `agentCard` |
| `GET` | `/admin/paircode` | `pairing` | `adminCode` |
| `POST` | `/admin/paircode/new` | `pairing` | `adminNewCode` |
| `POST` | `/admin/reload` | `system` | `reload` |
| `POST` | `/admin/shutdown` | `system` | `shutdown` |
| `POST` | `/admin/sop/approve` | `sops` | `approve` |
| `POST` | `/admin/sop/deny` | `sops` | `deny` |
| `GET` | `/admin/sop/pending` | `sops` | `pending` |
| `GET` | `/api/agents/{alias}/skills` | `agents` | `skills` |
| `GET` | `/api/agents/{alias}/workspace/list` | `agents` | `listFiles` |
| `POST` | `/api/agents/{alias}/workspace/mkdir` | `agents` | `makeDir` |
| `POST` | `/api/agents/{alias}/workspace/move` | `agents` | `movePath` |
| `DELETE` | `/api/agents/{alias}/workspace/path` | `agents` | `removePath` |
| `GET` | `/api/agents/{alias}/workspace/read` | `agents` | `readFile` |
| `GET` | `/api/browse` | `files` | `list` |
| `POST` | `/api/browse/mkdir` | `files` | `makeDir` |
| `DELETE` | `/api/browse/rmdir` | `files` | `removeDir` |
| `GET` | `/api/canvas` | `canvas` | `list` |
| `DELETE` | `/api/canvas/{id}` | `canvas` | `clear` |
| `GET` | `/api/canvas/{id}` | `canvas` | `current` |
| `POST` | `/api/canvas/{id}` | `canvas` | `publish` |
| `GET` | `/api/canvas/{id}/history` | `canvas` | `history` |
| `GET` | `/api/channels` | `channels` | `list` |
| `POST` | `/api/channels/bind` | `channels` | `bind` |
| `POST` | `/api/channels/{channel}/messages/{message_id}/redeliver` | `channels` | `redeliver` |
| `POST` | `/api/channels/{channel}/relink` | `channels` | `relink` |
| `GET` | `/api/channels/{channel}/rooms` | `channels` | `rooms` |
| `POST` | `/api/channels/{channel}/rooms` | `channels` | `createRoom` |
| `POST` | `/api/channels/{channel}/rooms/{room}/invites` | `channels` | `invite` |
| `GET` | `/api/channels/{channel}/rooms/{room}/members` | `channels` | `roomMembers` |
| `DELETE` | `/api/channels/{channel}/rooms/{room}/members/{user}` | `channels` | `removeMember` |
| `POST` | `/api/channels/{channel}/send` | `channels` | `send` |
| `GET` | `/api/cli-tools` | `system` | `cliTools` |
| `GET` | `/api/config` | `config` | `snapshot` |
| `OPTIONS` | `/api/config` | `config` | `schema` |
| `PATCH` | `/api/config` | `config` | `patch` |
| `GET` | `/api/config/agent-options` | `config` | `agentOptions` |
| `GET` | `/api/config/catalog` | `config` | `catalog` |
| `GET` | `/api/config/catalog/models` | `config` | `catalogModels` |
| `GET` | `/api/config/delete-plan` | `config` | `deletePlan` |
| `GET` | `/api/config/drift` | `config` | `drift` |
| `POST` | `/api/config/init` | `config` | `init` |
| `GET` | `/api/config/list` | `config` | `list` |
| `DELETE` | `/api/config/map-key` | `config` | `deleteMapKey` |
| `POST` | `/api/config/map-key` | `config` | `createMapKey` |
| `GET` | `/api/config/map-keys` | `config` | `mapKeys` |
| `POST` | `/api/config/migrate` | `config` | `migrate` |
| `POST` | `/api/config/model-providers/{type}/{alias}/refresh-context-window` | `config` | `refreshContextWindow` |
| `DELETE` | `/api/config/prop` | `config` | `reset` |
| `GET` | `/api/config/prop` | `config` | `get` |
| `OPTIONS` | `/api/config/prop` | `config` | `propSchema` |
| `PUT` | `/api/config/prop` | `config` | `set` |
| `GET` | `/api/config/reload-status` | `config` | `pendingReload` |
| `POST` | `/api/config/rename-map-key` | `config` | `renameMapKey` |
| `GET` | `/api/config/resolve-alias-source` | `config` | `aliasValues` |
| `GET` | `/api/config/sections` | `config` | `sections` |
| `GET` | `/api/config/sections/{section}` | `config` | `sectionItems` |
| `POST` | `/api/config/sections/{section}/items/{key}` | `config` | `selectSectionItem` |
| `GET` | `/api/config/status` | `config` | `status` |
| `GET` | `/api/config/templates` | `config` | `templates` |
| `GET` | `/api/cost` | `cost` | `agent` |
| `GET` | `/api/cost` | `cost` | `summary` |
| `GET` | `/api/cron` | `cron` | `list` |
| `POST` | `/api/cron` | `cron` | `create` |
| `GET` | `/api/cron/settings` | `cron` | `settings` |
| `PATCH` | `/api/cron/settings` | `cron` | `updateSettings` |
| `DELETE` | `/api/cron/{id}` | `cron` | `delete` |
| `PATCH` | `/api/cron/{id}` | `cron` | `update` |
| `POST` | `/api/cron/{id}/run` | `cron` | `run` |
| `GET` | `/api/cron/{id}/runs` | `cron` | `runs` |
| `GET` | `/api/devices` | `pairing` | `devices` |
| `POST` | `/api/devices/me/capabilities` | `pairing` | `setCapabilities` |
| `DELETE` | `/api/devices/{id}` | `pairing` | `revokeDevice` |
| `POST` | `/api/devices/{id}/token/rotate` | `pairing` | `rotateDeviceToken` |
| `POST` | `/api/doctor` | `system` | `doctor` |
| `GET` | `/api/events` | `events` | `subscribe` |
| `GET` | `/api/events/history` | `events` | `history` |
| `GET` | `/api/health` | `system` | `runtimeHealth` |
| `GET` | `/api/integrations` | `system` | `integrations` |
| `GET` | `/api/integrations/settings` | `system` | `integrationSettings` |
| `GET` | `/api/logs` | `system` | `logs` |
| `GET` | `/api/memory` | `memory` | `search` |
| `POST` | `/api/memory` | `memory` | `store` |
| `DELETE` | `/api/memory/{key}` | `memory` | `forget` |
| `GET` | `/api/openapi.json` | `system` | `openapi` |
| `POST` | `/api/pair` | `pairing` | `pair` |
| `POST` | `/api/pairing/initiate` | `pairing` | `newCode` |
| `GET` | `/api/personality` | `agents` | `personalityFiles` |
| `GET` | `/api/personality/templates` | `agents` | `personalityTemplates` |
| `GET` | `/api/personality/{filename}` | `agents` | `personality` |
| `PUT` | `/api/personality/{filename}` | `agents` | `writePersonality` |
| `POST` | `/api/quickstart/apply` | `quickstart` | `apply` |
| `POST` | `/api/quickstart/dismiss` | `quickstart` | `dismiss` |
| `POST` | `/api/quickstart/fields` | `quickstart` | `fields` |
| `GET` | `/api/quickstart/state` | `quickstart` | `state` |
| `POST` | `/api/quickstart/validate` | `quickstart` | `validate` |
| `GET` | `/api/sessions` | `sessions` | `list` |
| `GET` | `/api/sessions/running` | `sessions` | `running` |
| `DELETE` | `/api/sessions/{id}` | `sessions` | `delete` |
| `PUT` | `/api/sessions/{id}` | `sessions` | `rename` |
| `POST` | `/api/sessions/{id}/abort` | `sessions` | `abort` |
| `GET` | `/api/sessions/{id}/messages` | `sessions` | `messages` |
| `POST` | `/api/sessions/{id}/messages` | `sessions` | `addMessage` |
| `GET` | `/api/sessions/{id}/state` | `sessions` | `state` |
| `GET` | `/api/skills/bundles` | `skills` | `bundles` |
| `GET` | `/api/skills/bundles/{bundle}/skills` | `skills` | `list` |
| `POST` | `/api/skills/bundles/{bundle}/skills` | `skills` | `create` |
| `DELETE` | `/api/skills/bundles/{bundle}/skills/{name}` | `skills` | `delete` |
| `GET` | `/api/skills/bundles/{bundle}/skills/{name}` | `skills` | `read` |
| `PUT` | `/api/skills/bundles/{bundle}/skills/{name}` | `skills` | `write` |
| `GET` | `/api/skills/slash-option-kinds` | `skills` | `slashOptionKinds` |
| `GET` | `/api/sops` | `sops` | `list` |
| `POST` | `/api/sops` | `sops` | `create` |
| `POST` | `/api/sops/graph-draft` | `sops` | `graphDraft` |
| `GET` | `/api/sops/graph-legend` | `sops` | `graphLegend` |
| `GET` | `/api/sops/runs` | `sops` | `runs` |
| `GET` | `/api/sops/trigger-sources` | `sops` | `triggerSources` |
| `POST` | `/api/sops/wire-draft` | `sops` | `wireDraft` |
| `DELETE` | `/api/sops/{name}` | `sops` | `delete` |
| `PUT` | `/api/sops/{name}` | `sops` | `save` |
| `GET` | `/api/sops/{name}/full` | `sops` | `get` |
| `GET` | `/api/sops/{name}/graph` | `sops` | `graph` |
| `POST` | `/api/sops/{name}/run` | `sops` | `run` |
| `POST` | `/api/sops/{name}/runs/{run_id}/cancel` | `sops` | `cancel` |
| `POST` | `/api/sops/{name}/runs/{run_id}/decide` | `sops` | `decide` |
| `GET` | `/api/sops/{name}/runs/{run_id}/overlay` | `sops` | `runOverlay` |
| `GET` | `/api/status` | `system` | `status` |
| `GET` | `/api/tools` | `system` | `tools` |
| `POST` | `/api/tools/param-options` | `system` | `toolParamOptions` |
| `GET` | `/api/tuis` | `system` | `tuis` |
| `POST` | `/api/upload` | `files` | `uploadImage` |
| `GET` | `/api/version/check` | `system` | `versionCheck` |
| `POST` | `/api/version/upgrade` | `system` | `upgrade` |
| `GET` | `/api/version/upgrade/status` | `system` | `upgradeStatus` |
| `POST` | `/api/webauthn/auth/finish` | `webauthn` | `authFinish` |
| `POST` | `/api/webauthn/auth/start` | `webauthn` | `authStart` |
| `GET` | `/api/webauthn/credentials` | `webauthn` | `credentials` |
| `DELETE` | `/api/webauthn/credentials/{id}` | `webauthn` | `deleteCredential` |
| `POST` | `/api/webauthn/register/finish` | `webauthn` | `registerFinish` |
| `POST` | `/api/webauthn/register/start` | `webauthn` | `registerStart` |
| `GET` | `/health` | `system` | `health` |
| `GET` | `/metrics` | `system` | `metrics` |
| `POST` | `/pair` | `pairing` | `pairLegacy` |
| `GET` | `/pair/code` | `pairing` | `initialCode` |
| `POST` | `/webhook` | `webhook` | `send` |
| `GET` | `/ws/canvas/{id}` | `canvas` | `watch` |
| `GET` | `/ws/chat` | `client` | `chat` |
| `GET` | `/ws/sops/runs` | `sops` | `watchRuns` |
