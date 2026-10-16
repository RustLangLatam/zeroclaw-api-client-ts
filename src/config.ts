/**
 * Configuration: per-property reads and writes, atomic JSON Patch batches,
 * map aliases (agents, providers, channels…), drift, catalogs and the setup
 * sections.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api_config.rs` and
 * `api_sections.rs`. Property paths are dotted
 * (`providers.models.openai.default.api_key`). Reads return values as the
 * gateway's display strings; writes take typed JSON, which the gateway
 * coerces to the field's kind. Secrets are never returned: their reads say
 * only whether they are populated.
 *
 * @module
 */

import type { Client } from "./client.js";

/** The header that lets {@link ConfigApi.patch} overwrite paths changed on disk since the gateway loaded them. */
export const OVERRIDE_DRIFT_HEADER = "X-ZeroClaw-Override-Drift";

/** A validation problem the gateway reports without refusing the write. */
export interface ValidationWarning {
  /** Stable, e.g. `pre_existing_validation_error`. */
  code: string;
  /** What is wrong. */
  message: string;
  /** The field concerned. */
  path: string;
}

/**
 * A field as GET, PUT and DELETE `/api/config/prop` return it. A regular
 * field carries `value`, a secret only `populated`.
 */
export interface PropValue {
  /** The dotted path. */
  path: string;
  /** The gateway's display value (`null` after a reset, and absent for secrets). */
  value?: unknown;
  /** Validation problems of the configuration. */
  warnings?: ValidationWarning[] | null;
  /** For a secret, whether it has a value. */
  populated?: boolean | null;
}

/** Whether a {@link PropValue} is a secret (only `populated` is known). */
export function isSecret(prop: PropValue): boolean {
  return prop.populated !== undefined && prop.populated !== null;
}

/**
 * One operation of {@link ConfigApi.patch}: RFC 6902 `add`, `replace`,
 * `remove` and `test`, plus ZeroClaw's `comment`. Build it with
 * {@link PatchOps}.
 */
export interface PatchOp {
  /** `add`, `replace`, `remove`, `test` or `comment`. */
  op: "add" | "replace" | "remove" | "test" | "comment";
  /** Dotted, or a JSON Pointer (`/a/b`). */
  path: string;
  /** The value for `add`, `replace` and `test`. */
  value?: unknown;
  /** The TOML comment written above the key. */
  comment?: string;
}

/** Builders of {@link PatchOp}. */
export const PatchOps = {
  /** Sets `path` to `value`. */
  replace: (path: string, value: unknown): PatchOp => ({ op: "replace", path, value }),
  /** Sets `path` to `value`, creating the map alias it implies. */
  add: (path: string, value: unknown): PatchOp => ({ op: "add", path, value }),
  /** Resets `path` to its default. */
  remove: (path: string): PatchOp => ({ op: "remove", path }),
  /** Fails the whole patch unless `path` currently displays as `value`. */
  test: (path: string, value: unknown): PatchOp => ({ op: "test", path, value }),
  /** Writes `comment` above the key of `path`. */
  comment: (path: string, comment: string): PatchOp => ({ op: "comment", path, comment }),
} as const;

/** What one patch operation left. */
export interface PatchOpResult {
  /** The operation. */
  op: string;
  /** The dotted path. */
  path: string;
  /** The new display value (absent for secrets and comments). */
  value?: unknown;
  /** For secrets, whether it now has a value. */
  populated?: boolean | null;
  /** For `comment`, the comment written. */
  comment?: string | null;
}

/** The result of {@link ConfigApi.patch}. */
export interface PatchResponse {
  /** Always true on success: the patch was saved. */
  saved: boolean;
  /** One result per operation, in order. */
  results: PatchOpResult[];
  /** Validation problems outside the patched paths. */
  warnings?: ValidationWarning[] | null;
}

/** A field whose value on disk differs from the gateway's. */
export interface DriftEntry {
  /** The dotted path. */
  path: string;
  /** Whether it is a secret (no values shown). */
  secret?: boolean;
  /** Always true. */
  drifted: boolean;
  /** The gateway's value. */
  in_memory_value?: unknown;
  /** The value in `config.toml`. */
  on_disk_value?: unknown;
}

/** One configuration field. */
export interface ConfigEntry {
  /** The dotted path. */
  path: string;
  /** Groups fields. */
  category: string;
  /**
   * `string`, `bool`, `integer`, `float`, `enum`, `alias-ref`,
   * `string-array`, `object-array` or `object`.
   */
  kind: string;
  /** The Rust type, e.g. `Option<String>`. */
  type_hint: string;
  /** The display value; absent for secrets. */
  value?: unknown;
  /** Whether it has a value. */
  populated: boolean;
  /** Whether it is a secret. */
  is_secret: boolean;
  /** Whether an environment variable overrides it. */
  is_env_overridden?: boolean;
  /** The allowed values of an enum. */
  enum_variants?: string[] | null;
  /** The setup section it belongs to. */
  section?: string | null;
  /** The dashboard tab. */
  tab?: string;
  /** Whether it is edited as multi-line text. */
  multiline?: boolean;
}

/** The result of {@link ConfigApi.list}. */
export interface ConfigList {
  /** The fields. */
  entries: ConfigEntry[];
  /** The fields whose value on disk differs from the gateway's. */
  drifted?: DriftEntry[] | null;
}

/** The result of {@link ConfigApi.migrate}. */
export interface MigrateResponse {
  /** Whether the file changed. */
  migrated: boolean;
  /** Where the previous file was kept. */
  backup_path?: string | null;
  /** The schema version now on disk. */
  schema_version: number;
}

/** A map or list section and the type of its entries. */
export interface TemplateEntry {
  /** The dotted path. */
  path: string;
  /** `map` or `list`. */
  kind: string;
  /** The Rust type of an entry. */
  value_type: string;
  /** What the section holds. */
  description: string;
}

/** The result of creating or deleting a map alias. */
export interface MapKeyResponse {
  /** The map section. */
  path: string;
  /** The alias. */
  key: string;
  /** Whether a new alias was created. */
  created: boolean;
  /** Cleanup steps that failed after the change was saved. */
  warnings?: string[] | null;
}

/** A field that references an alias. */
export interface ReferenceSite {
  /** The dotted path of the referencing field. */
  path: string;
  /** Its raw value. */
  raw_value: string;
}

/** What deleting an alias would do. */
export interface DeletePlan {
  /** The map section. */
  path: string;
  /** The alias. */
  key: string;
  /** Whether the delete would go through. */
  allowed: boolean;
  /** The references that block it. */
  blockers: ReferenceSite[];
  /** The references it would clear. */
  scrubs: ReferenceSite[];
  /** For agents, the live ACP sessions (they block the delete). */
  live_acp_sessions?: number | null;
  /** Whether the agent's memory, cron jobs and sessions go too. */
  cascades_owned_state: boolean;
}

/** The result of {@link ConfigApi.renameMapKey}. */
export interface RenameResponse {
  /** The map section. */
  path: string;
  /** The old alias. */
  from: string;
  /** The new alias. */
  to: string;
  /** Whether it was renamed. */
  renamed: boolean;
  /** Follow-up steps that failed (re-sending the rename finishes them). */
  warnings?: string[] | null;
}

/** An alias kind an alias-reference field can point to. */
export type AliasSource =
  | "model_providers"
  | "tts_providers"
  | "transcription_providers"
  | "channels"
  | "risk_profiles"
  | "runtime_profiles"
  | "agents"
  | "skill_bundles"
  | "knowledge_bundles"
  | "mcp_bundles";

/** A model provider the build knows. */
export interface CatalogModelProvider {
  /** The provider family name. */
  name: string;
  /** Shown to people. */
  display_name: string;
  /** Whether it runs locally. */
  local: boolean;
}

/** A model's prices as the provider states them. */
export interface ModelPricing {
  /** The input price. */
  prompt?: string | null;
  /** The output price. */
  completion?: string | null;
  /** The cached input read price. */
  input_cache_read?: string | null;
  /** The cached input write price. */
  input_cache_write?: string | null;
}

/** The models of a provider. */
export interface CatalogModels {
  /** The provider family name. */
  model_provider: string;
  /** The model ids. */
  models: string[];
  /** The prices per model, when the provider publishes them. */
  pricing?: Record<string, ModelPricing> | null;
  /** Whether it runs locally. */
  local: boolean;
  /** Whether the list came live from the provider. */
  live: boolean;
}

/** Whether the setup is complete. */
export interface ConfigStatus {
  /** Whether the quickstart still has to run. */
  needs_quickstart: boolean;
  /** `has_dispatchable_agent`, `incomplete_agent` or `fresh_install`. */
  reason: string;
  /** Whether part of the setup is done. */
  has_partial_state: boolean;
  /** The steps left, in words. */
  missing: string[];
}

/** The aliases an agent can reference. */
export interface AgentOptions {
  /** Channels, as `type.alias`. */
  channels: string[];
  /** The channel types. */
  channel_types: string[];
  /** Model providers, as `type.alias`. */
  model_providers: string[];
  /** The risk profiles. */
  risk_profiles: string[];
  /** The runtime profiles. */
  runtime_profiles: string[];
  /** The skill bundles. */
  skill_bundles: string[];
  /** The knowledge bundles. */
  knowledge_bundles: string[];
  /** The MCP bundles. */
  mcp_bundles: string[];
  /** The agents. */
  agents: string[];
}

/** A setup section. */
export interface ConfigSection {
  /** The section key, e.g. `providers.models`. */
  key: string;
  /** Shown to people. */
  label: string;
  /** The help text. */
  help: string;
  /** Whether it offers items to pick ({@link ConfigApi.sectionItems}). */
  has_picker: boolean;
  /** Whether it is completed. */
  completed: boolean;
  /** Whether it is ready to use. */
  ready?: boolean;
  /** The group it is shown under. */
  group?: string;
  /** Whether the quickstart includes it. */
  is_quickstart?: boolean;
  /** `direct_form`, `one_tier_alias_map`, `typed_family_map` or `backend_picker`. */
  shape?: string | null;
  /** The cost category. */
  cost_category?: string;
}

/** An item of a picker section. */
export interface SectionItem {
  /** The item key. */
  key: string;
  /** Shown to people. */
  label: string;
  /** What it is. */
  description?: string | null;
  /** `configured`, `needs setup`, `active` or `created`. */
  badge?: string | null;
}

/** The items of a picker section. */
export interface SectionItems {
  /** The section key. */
  section: string;
  /** The items. */
  items: SectionItem[];
  /** The help text. */
  help: string;
}

/** The result of {@link ConfigApi.selectSectionItem}. */
export interface SelectedItem {
  /** The prefix of the fields to fill ({@link ConfigApi.list}). */
  fields_prefix: string;
  /** Whether something was created. */
  created: boolean;
}

/** The configuration endpoints (`/api/config`), from {@link Client.config}. */
export class ConfigApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /**
   * `GET /api/config`: the whole configuration with secrets masked as
   * `***MASKED***`. A compatibility snapshot; prefer {@link ConfigApi.list}
   * and {@link ConfigApi.get}, which carry field metadata.
   */
  async snapshot(): Promise<unknown> {
    return this.#c._json("GET", ["api", "config"]);
  }

  /** `OPTIONS /api/config`: the JSON Schema of the whole configuration. Static per gateway build. Public. */
  async schema(): Promise<unknown> {
    return this.#c._json("OPTIONS", ["api", "config"]);
  }

  /** `OPTIONS /api/config/prop`: the schema plus the field's metadata under `x-zeroclaw-prop`. Public. */
  async propSchema(path: string): Promise<unknown> {
    return this.#c._json("OPTIONS", ["api", "config", "prop"], { query: { path } });
  }

  /** `GET /api/config/prop`: reads one field. */
  async get(path: string): Promise<PropValue> {
    return this.#c._json("GET", ["api", "config", "prop"], { query: { path } });
  }

  /**
   * `PUT /api/config/prop`: writes one field. `value` is sent as JSON
   * (`null` resets it); a non-empty `comment` is written above the key in
   * the TOML. A map alias implied by the path is created.
   */
  async set(path: string, value: unknown, comment?: string): Promise<PropValue> {
    const body: Record<string, unknown> = { path, value: value ?? null };
    if (comment) body.comment = comment;
    return this.#c._json("PUT", ["api", "config", "prop"], { json: body });
  }

  /** `DELETE /api/config/prop`: resets one field to its default. */
  async reset(path: string): Promise<PropValue> {
    return this.#c._json("DELETE", ["api", "config", "prop"], { query: { path } });
  }

  /**
   * `PATCH /api/config`: applies `ops` atomically, all or nothing. With
   * `overrideDrift`, paths edited on disk since the gateway loaded them are
   * overwritten instead of refused with 409.
   */
  async patch(ops: readonly PatchOp[], overrideDrift = false): Promise<PatchResponse> {
    return this.#c._json("PATCH", ["api", "config"], {
      json: ops,
      headers: overrideDrift ? { [OVERRIDE_DRIFT_HEADER]: "true" } : {},
    });
  }

  /**
   * `GET /api/config/list`: every field reachable under `prefix` (all fields
   * without one), with its kind, category and current value.
   */
  async list(prefix?: string): Promise<ConfigList> {
    return this.#c._json("GET", ["api", "config", "list"], { query: { prefix } });
  }

  /** `GET /api/config/drift`: the fields whose value on disk differs from the gateway's. */
  async drift(): Promise<DriftEntry[]> {
    return this.#c._field("GET", ["api", "config", "drift"], "drifted");
  }

  /** `GET /api/config/reload-status`: whether saved changes wait for a daemon reload. */
  async pendingReload(): Promise<boolean> {
    return this.#c._field("GET", ["api", "config", "reload-status"], "pending_reload");
  }

  /**
   * `POST /api/config/init`: fills unset nested sections under `section`
   * (everywhere without one) with defaults and returns those created.
   */
  async init(section?: string): Promise<string[]> {
    return this.#c._field("POST", ["api", "config", "init"], "initialized", {
      query: { section },
    });
  }

  /** `POST /api/config/migrate`: migrates `config.toml` to the current schema in place, keeping a backup. */
  async migrate(): Promise<MigrateResponse> {
    return this.#c._json("POST", ["api", "config", "migrate"]);
  }

  /** `GET /api/config/templates`: the map and list sections and the type of their entries. */
  async templates(): Promise<TemplateEntry[]> {
    return this.#c._field("GET", ["api", "config", "templates"], "templates");
  }

  /** `GET /api/config/map-keys`: the aliases of a map section, e.g. `agents` or `channels.whatsapp`. */
  async mapKeys(path: string): Promise<string[]> {
    return this.#c._field("GET", ["api", "config", "map-keys"], "keys", { query: { path } });
  }

  /**
   * `POST /api/config/map-key`: creates alias `key` under map `path` with
   * defaults; `created` is false when it already existed.
   */
  async createMapKey(path: string, key: string): Promise<MapKeyResponse> {
    return this.#c._json("POST", ["api", "config", "map-key"], { query: { path, key } });
  }

  /**
   * `DELETE /api/config/map-key`: removes alias `key` and the references to
   * it. Deleting an agent also archives its workspace and its memory, cron
   * jobs and sessions; check {@link ConfigApi.deletePlan} first.
   */
  async deleteMapKey(path: string, key: string): Promise<MapKeyResponse> {
    return this.#c._json("DELETE", ["api", "config", "map-key"], { query: { path, key } });
  }

  /** `GET /api/config/delete-plan`: what deleting alias `key` would block on or rewrite, changing nothing. */
  async deletePlan(path: string, key: string): Promise<DeletePlan> {
    return this.#c._json("GET", ["api", "config", "delete-plan"], { query: { path, key } });
  }

  /** `POST /api/config/rename-map-key`: renames alias `from` to `to`, and every reference to it. */
  async renameMapKey(path: string, from: string, to: string): Promise<RenameResponse> {
    return this.#c._json("POST", ["api", "config", "rename-map-key"], { json: { path, from, to } });
  }

  /**
   * `POST /api/config/model-providers/{type}/{alias}/refresh-context-window`:
   * asks the provider for the model's context window and stores it.
   */
  async refreshContextWindow(providerType: string, alias: string): Promise<number> {
    return this.#c._field(
      "POST",
      ["api", "config", "model-providers", providerType, alias, "refresh-context-window"],
      "context_window",
    );
  }

  /**
   * `GET /api/config/resolve-alias-source`: the aliases an alias-reference
   * field may point to; providers and channels as `type.alias`.
   */
  async aliasValues(source: AliasSource): Promise<string[]> {
    return this.#c._field("GET", ["api", "config", "resolve-alias-source"], "values", {
      query: { source },
    });
  }

  /** `GET /api/config/catalog`: the model providers this build knows. */
  async catalog(): Promise<CatalogModelProvider[]> {
    return this.#c._field("GET", ["api", "config", "catalog"], "model_providers");
  }

  /**
   * `GET /api/config/catalog/models`: the models of a provider. It may call
   * the provider with the configured credentials.
   */
  async catalogModels(modelProvider: string): Promise<CatalogModels> {
    return this.#c._json("GET", ["api", "config", "catalog", "models"], {
      query: { model_provider: modelProvider },
    });
  }

  /** `GET /api/config/status`: whether the setup is complete. */
  async status(): Promise<ConfigStatus> {
    return this.#c._json("GET", ["api", "config", "status"]);
  }

  /** `GET /api/config/agent-options`: the aliases an agent can reference. */
  async agentOptions(): Promise<AgentOptions> {
    return this.#c._json("GET", ["api", "config", "agent-options"]);
  }

  /** `GET /api/config/sections`: the setup sections, in wizard order. */
  async sections(): Promise<ConfigSection[]> {
    return this.#c._field("GET", ["api", "config", "sections"], "sections");
  }

  /** `GET /api/config/sections/{section}`: the items a picker section offers, e.g. the provider families of `providers.models`. */
  async sectionItems(section: string): Promise<SectionItems> {
    return this.#c._json("GET", ["api", "config", "sections", section]);
  }

  /**
   * `POST /api/config/sections/{section}/items/{key}`: picks an item,
   * creating what it needs, and returns where its fields live. Without
   * `alias` the gateway uses `default` where the section takes one.
   */
  async selectSectionItem(section: string, key: string, alias?: string): Promise<SelectedItem> {
    return this.#c._json("POST", ["api", "config", "sections", section, "items", key], {
      json: { alias: alias || null },
    });
  }
}
