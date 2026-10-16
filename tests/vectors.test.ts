// Response vectors: answers captured from a real gateway
// (`scripts/capture-vectors.py` in the Rust client, anonymized). Each must
// fit the client's type (checked by the compiler) and come out of its call
// unchanged (checked at run time).

import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  AgentOptions,
  AgentSkills,
  CatalogModelProvider,
  Channel,
  ConfigList,
  ConfigSection,
  ConfigStatus,
  CostSummary,
  CronJob,
  CronSettings,
  Device,
  DriftEntry,
  GatewayEvent,
  Health,
  HealthSnapshot,
  Integration,
  IntegrationSetting,
  PersonalityFiles,
  Session,
  SkillBundle,
  Status,
  TemplateEntry,
  ToolSpec,
  Tui,
} from "../src/index.js";
import { gateway, json } from "./helpers.js";
import vAgentSkills from "./vectors/agent_skills.json" with { type: "json" };
import vChannels from "./vectors/channels.json" with { type: "json" };
import vConfigAgentOptions from "./vectors/config_agent_options.json" with { type: "json" };
import vConfigCatalog from "./vectors/config_catalog.json" with { type: "json" };
import vConfigDrift from "./vectors/config_drift.json" with { type: "json" };
import vConfigList from "./vectors/config_list.json" with { type: "json" };
import vConfigMapKeys from "./vectors/config_map_keys.json" with { type: "json" };
import vConfigReloadStatus from "./vectors/config_reload_status.json" with { type: "json" };
import vConfigSections from "./vectors/config_sections.json" with { type: "json" };
import vConfigStatus from "./vectors/config_status.json" with { type: "json" };
import vConfigTemplates from "./vectors/config_templates.json" with { type: "json" };
import vCost from "./vectors/cost.json" with { type: "json" };
import vCronList from "./vectors/cron_list.json" with { type: "json" };
import vCronSettings from "./vectors/cron_settings.json" with { type: "json" };
import vDevices from "./vectors/devices.json" with { type: "json" };
import vEventsHistory from "./vectors/events_history.json" with { type: "json" };
import vHealth from "./vectors/health.json" with { type: "json" };
import vIntegrationSettings from "./vectors/integration_settings.json" with { type: "json" };
import vIntegrations from "./vectors/integrations.json" with { type: "json" };
import vPersonalityFiles from "./vectors/personality_files.json" with { type: "json" };
import vQuickstartState from "./vectors/quickstart_state.json" with { type: "json" };
import vRuntimeHealth from "./vectors/runtime_health.json" with { type: "json" };
import vSessions from "./vectors/sessions.json" with { type: "json" };
import vSkillBundles from "./vectors/skill_bundles.json" with { type: "json" };
import vSlashOptionKinds from "./vectors/slash_option_kinds.json" with { type: "json" };
import vStatus from "./vectors/status.json" with { type: "json" };
import vTools from "./vectors/tools.json" with { type: "json" };
import vTuis from "./vectors/tuis.json" with { type: "json" };

type Vector = { route: string; build: string; response: Record<string, unknown> };

// The compiler checks that each captured answer fits its type.
export const agent_skills: AgentSkills = vAgentSkills.response;
export const channels: Channel[] = vChannels.response.channels;
export const config_agent_options: AgentOptions = vConfigAgentOptions.response;
export const config_catalog: CatalogModelProvider[] = vConfigCatalog.response.model_providers;
export const config_drift: DriftEntry[] = vConfigDrift.response.drifted;
export const config_list: ConfigList = vConfigList.response;
export const config_map_keys: string[] = vConfigMapKeys.response.keys;
export const config_reload_status: boolean = vConfigReloadStatus.response.pending_reload;
export const config_sections: ConfigSection[] = vConfigSections.response.sections;
export const config_status: ConfigStatus = vConfigStatus.response;
export const config_templates: TemplateEntry[] = vConfigTemplates.response.templates;
export const cost: CostSummary = vCost.response.cost;
export const cron_list: CronJob[] = vCronList.response.jobs;
export const cron_settings: CronSettings = vCronSettings.response;
export const devices: Device[] = vDevices.response.devices;
export const events_history: GatewayEvent[] = vEventsHistory.response.events;
export const health: Health = vHealth.response;
export const integration_settings: Record<string, IntegrationSetting> =
  vIntegrationSettings.response.settings;
export const integrations: Integration[] = vIntegrations.response.integrations;
export const personality_files: PersonalityFiles = vPersonalityFiles.response;
export const quickstart_state: unknown = vQuickstartState.response;
export const runtime_health: HealthSnapshot = vRuntimeHealth.response.health;
export const sessions: Session[] = vSessions.response.sessions;
export const skill_bundles: SkillBundle[] = vSkillBundles.response.bundles;
export const slash_option_kinds: unknown[] = vSlashOptionKinds.response.kinds;
export const status: Status = vStatus.response;
export const tools: ToolSpec[] = vTools.response.tools;
export const tuis: Tui[] = vTuis.response.tuis;

const CASES: Array<
  [string, Vector, string | null, (c: import("../src/index.js").Client) => Promise<unknown>]
> = [
  [
    "agent_skills",
    vAgentSkills as Vector,
    null,
    (c) => c.agent("zc_agent_00000000000000000000000000000000").skills(),
  ],
  ["channels", vChannels as Vector, "channels", (c) => c.channels.list()],
  ["config_agent_options", vConfigAgentOptions as Vector, null, (c) => c.config.agentOptions()],
  ["config_catalog", vConfigCatalog as Vector, "model_providers", (c) => c.config.catalog()],
  ["config_drift", vConfigDrift as Vector, "drifted", (c) => c.config.drift()],
  ["config_list", vConfigList as Vector, null, (c) => c.config.list("gateway")],
  ["config_map_keys", vConfigMapKeys as Vector, "keys", (c) => c.config.mapKeys("agents")],
  [
    "config_reload_status",
    vConfigReloadStatus as Vector,
    "pending_reload",
    (c) => c.config.pendingReload(),
  ],
  ["config_sections", vConfigSections as Vector, "sections", (c) => c.config.sections()],
  ["config_status", vConfigStatus as Vector, null, (c) => c.config.status()],
  ["config_templates", vConfigTemplates as Vector, "templates", (c) => c.config.templates()],
  ["cost", vCost as Vector, "cost", (c) => c.cost.summary()],
  ["cron_list", vCronList as Vector, "jobs", (c) => c.cron.list()],
  ["cron_settings", vCronSettings as Vector, null, (c) => c.cron.settings()],
  ["devices", vDevices as Vector, "devices", (c) => c.pairing.devices()],
  ["events_history", vEventsHistory as Vector, "events", (c) => c.events.history()],
  ["health", vHealth as Vector, null, (c) => c.system.health()],
  [
    "integration_settings",
    vIntegrationSettings as Vector,
    "settings",
    (c) => c.system.integrationSettings(),
  ],
  ["integrations", vIntegrations as Vector, "integrations", (c) => c.system.integrations()],
  [
    "personality_files",
    vPersonalityFiles as Vector,
    null,
    (c) => c.agent("zc_agent_00000000000000000000000000000000").personalityFiles(),
  ],
  ["quickstart_state", vQuickstartState as Vector, null, (c) => c.quickstart.state()],
  ["runtime_health", vRuntimeHealth as Vector, "health", (c) => c.system.runtimeHealth()],
  ["sessions", vSessions as Vector, "sessions", (c) => c.sessions.list()],
  ["skill_bundles", vSkillBundles as Vector, "bundles", (c) => c.skills.bundles()],
  ["slash_option_kinds", vSlashOptionKinds as Vector, "kinds", (c) => c.skills.slashOptionKinds()],
  ["status", vStatus as Vector, null, (c) => c.system.status()],
  ["tools", vTools as Vector, "tools", (c) => c.system.tools()],
  ["tuis", vTuis as Vector, "tuis", (c) => c.system.tuis()],
];

for (const [name, vector, field, call] of CASES) {
  test(`vector ${name} (${vector.route})`, async () => {
    const { client, requests } = gateway(() => json(vector.response));
    const result = await call(client);
    assert.equal(requests[0]?.url.pathname, vector.route.split("?")[0]);
    assert.deepEqual(result, field === null ? vector.response : vector.response[field]);
  });
}
