/**
 * The gateway itself: health, status, metrics, diagnostics, tools,
 * integrations and logs; also version upgrades and daemon administration.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/lib.rs` (`/health`,
 * `/metrics`, `/admin/*`), `api.rs`, `api_logs.rs`, `version.rs` and
 * `api_sop_author.rs` (tool parameter options).
 *
 * @module
 */

import type { Client, QueryValue } from "./client.js";

/** The answer of `GET /health`. */
export interface Health {
  /** Always `ok` while the gateway answers. */
  status: string;
  /** Whether at least one client is paired. */
  paired: boolean;
  /** Whether requests need a bearer token. */
  require_pairing: boolean;
  /** The component health (raw when the gateway could not serialize it). */
  runtime?: unknown;
}

/** One component's health. */
export interface ComponentHealth {
  /** `ok`, `error`, … */
  status: string;
  /** The last update (RFC 3339). */
  updated_at: string;
  /** The last time it was healthy. */
  last_ok?: string | null;
  /** The last error. */
  last_error?: string | null;
  /** How many times it was restarted. */
  restart_count: number;
}

/** The runtime's component health. */
export interface HealthSnapshot {
  /** The daemon process id. */
  pid: number;
  /** When it was computed (RFC 3339). */
  updated_at: string;
  /** The time since the daemon started, in seconds. */
  uptime_seconds: number;
  /** The health per component (`gateway`, `channel:whatsapp.x`, …). */
  components: Record<string, ComponentHealth>;
}

/** The daemon's resource use. */
export interface ProcessStats {
  /** The resident memory, in bytes. */
  rss_bytes: number;
  /** The host memory, in bytes. */
  system_ram_total_bytes: number;
  /** The CPU use. */
  cpu_percent?: number | null;
  /** The number of host CPUs. */
  num_cpus: number;
}

/** The answer of `GET /api/status`. */
export interface Status {
  /** The ZeroClaw version. */
  version: string;
  /** The model provider in use, as `type.alias`. */
  model_provider?: string | null;
  /** The model in use. */
  model: string;
  /** The sampling temperature. */
  temperature?: number | null;
  /** The time since the daemon started, in seconds. */
  uptime_seconds: number;
  /** When the daemon started (RFC 3339). */
  daemon_started_at: string;
  /** The gateway port. */
  gateway_port: number;
  /** The UI locale. */
  locale: string;
  /** The memory backend. */
  memory_backend: string;
  /** Whether a client is paired. */
  paired: boolean;
  /** The configured channels, as `type.alias`. */
  channels: Record<string, boolean>;
  /** The connected nodes and peers found on the network. */
  nodes?: unknown;
  /** The component health. */
  health: HealthSnapshot;
  /** The agent asked about, if any. */
  agent_alias?: string | null;
  /** The process figures. */
  process?: ProcessStats | null;
  /** Whether the daemon checks for updates. */
  check_updates: boolean;
  /** Whether self-upgrade is allowed. */
  allow_self_upgrade: boolean;
  /** `supervised`, `self_respawn` or `manual`. */
  restart_mode?: string | null;
  /** How to restart the daemon. */
  restart_hint?: string | null;
  /** The configuration a running channel picks up without a restart. */
  live_channel_config?: string[] | null;
}

/** One diagnostic. */
export interface Diagnostic {
  /** `ok`, `warn` or `error`. */
  severity: string;
  /** The area checked. */
  category: string;
  /** The finding. */
  message: string;
}

/** The result of {@link SystemApi.doctor}. */
export interface DoctorReport {
  /** Each check. */
  results: Diagnostic[];
  /** The results counted by severity. */
  summary: { ok: number; warnings: number; errors: number };
}

/** A tool an agent can call. */
export interface ToolSpec {
  /** The tool name. */
  name: string;
  /** What it does. */
  description: string;
  /** The JSON Schema of its arguments. */
  parameters?: unknown;
  /** The JSON Schema of its output, when declared. */
  output?: unknown;
  /** The option domain of the parameters that take known values. */
  param_domains?: Record<string, string> | null;
}

/** A value a tool parameter accepts. */
export interface ToolOption {
  /** The value. */
  value: string;
  /** The label to show. */
  label?: string | null;
  /** An extra hint. */
  hint?: string | null;
}

/** An integration. */
export interface Integration {
  /** The integration's name. */
  name: string;
  /** What it does. */
  description: string;
  /** `Chat`, `AiModel`, `ToolsAutomation` or `Platform`. */
  category: string;
  /** The category in words. */
  category_label: string;
  /** `Available` or `Active`. */
  status: string;
}

/** An integration's state. */
export interface IntegrationSetting {
  /** Whether it is active. */
  enabled: boolean;
  /** Its category. */
  category: string;
  /** Its status. */
  status: string;
}

/** A command-line tool on the host. */
export interface CliTool {
  /** The command name. */
  name: string;
  /** The full path. */
  path: string;
  /** The reported version. */
  version?: string | null;
  /** The kind of tool (`VersionControl`, `Language`, …). */
  category: string;
}

/** A terminal client connected to the daemon. */
export interface Tui {
  /** The client id. */
  tui_id: string;
  /** When it connected (RFC 3339). */
  connected_at: string;
  /** Who it is. */
  peer_label: string;
  /** `unix` or `wss`. */
  transport: string;
}

/** The filters of {@link SystemApi.logs}; unset, empty and zero values are not sent. */
export interface LogQuery {
  /** Keep events at or after (RFC 3339). */
  since_ts?: string;
  /** Keep events before (RFC 3339). */
  until_ts?: string;
  /** The paging cursor: the previous page's `next_cursor_line_offset`. */
  until_line_offset?: number;
  /** The event action. */
  action?: string;
  /** The event category. */
  category?: string;
  /** The event outcome. */
  outcome?: string;
  /** The minimum severity number. */
  severity_min?: number;
  /** The trace id. */
  trace_id?: string;
  /** Free text. */
  q?: string;
  /** Leave out the daemon's internal events. */
  hide_internal?: boolean;
  /** The page size (gateway default 200). */
  limit?: number;
  /** Exact matches on attribution fields (`agent_alias`, `channel`, `session_key`, `tool`, …). */
  attributes?: Record<string, string>;
}

/** A page of {@link SystemApi.logs}. */
export interface LogPage {
  /** The log events (OpenTelemetry-like JSON, see ZeroClaw's `LogEvent`). */
  events: unknown[];
  /** The cursor for the next (older) page. */
  next_cursor_line_offset?: number | null;
  /** Whether this is the oldest page. */
  at_end: boolean;
  /** When the daemon started. */
  daemon_started_at: string;
  /** The attribution fields that can be filtered on. */
  attribution_keys?: string[] | null;
}

/** The answer of {@link SystemApi.versionCheck}. */
export interface VersionCheck {
  /** The running version. */
  current_version: string;
  /** The latest release (`null` when the check failed). */
  latest_version?: string | null;
  /** Whether the latest is newer. */
  is_newer: boolean;
  /** The release page. */
  release_url?: string | null;
  /** The release notes (Markdown). */
  release_notes?: string | null;
  /** The release date. */
  published_at?: string | null;
  /** Why the check failed. */
  error?: string | null;
}

/** The progress of a self-upgrade. */
export interface UpgradeStatus {
  /** `idle`, `running`, `done`, `restarting` or `failed`. */
  state: string;
  /** The upgrade id. */
  handoff_id?: string | null;
  /** The step, 0 to 6. */
  phase?: number | null;
  /** The last log lines. */
  log_tail?: string[] | null;
  /** The version before. */
  previous_version?: string | null;
  /** The version being installed. */
  target_version?: string | null;
  /** How the daemon restarts. */
  restart_mode?: string | null;
  /** How to restart it by hand. */
  restart_hint?: string | null;
  /** Why it failed. */
  error?: string | null;
}

/** The answer of the `/admin` actions. */
export interface AdminResponse {
  /** Whether it was accepted. */
  success: boolean;
  /** What happens next. */
  message: string;
}

/** The gateway-wide endpoints, from {@link Client.system}. */
export class SystemApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /health`: liveness and component health. Public. */
  async health(): Promise<Health> {
    return this.#c._json("GET", ["health"]);
  }

  /** `GET /api/health`: the runtime's component health. */
  async runtimeHealth(): Promise<HealthSnapshot> {
    return this.#c._field("GET", ["api", "health"], "health");
  }

  /**
   * `GET /metrics`: the Prometheus text exposition. Public. 404 on a build
   * without the `observability-prometheus` feature.
   */
  async metrics(): Promise<string> {
    return this.#c._text("GET", ["metrics"]);
  }

  /**
   * `GET /api/status`: the version, model, channels, nodes and process
   * figures; with `agent`, that agent's model.
   */
  async status(agent?: string): Promise<Status> {
    return this.#c._json("GET", ["api", "status"], { query: { agent } });
  }

  /** `POST /api/doctor`: runs the configuration diagnostics. */
  async doctor(): Promise<DoctorReport> {
    return this.#c._json("POST", ["api", "doctor"]);
  }

  /** `GET /api/tools`: the tools `agent` (all of them without one) can call. */
  async tools(agent?: string): Promise<ToolSpec[]> {
    return this.#c._field("GET", ["api", "tools"], "tools", { query: { agent } });
  }

  /**
   * `POST /api/tools/param-options`: the values a tool parameter of `domain`
   * accepts. `domain` is `channel_refs`, `peer_targets`, `peer_groups`,
   * `agent_aliases`, `tool_names` or `memory_categories`; `args` holds the
   * sibling arguments the options depend on.
   */
  async toolParamOptions(domain: string, agent?: string, args?: unknown): Promise<ToolOption[]> {
    return this.#c._field("POST", ["api", "tools", "param-options"], "options", {
      json: { domain, agent: agent || null, args: args ?? null },
    });
  }

  /** `GET /api/integrations`: the integrations this build offers. */
  async integrations(): Promise<Integration[]> {
    return this.#c._field("GET", ["api", "integrations"], "integrations");
  }

  /** `GET /api/integrations/settings`: each integration's state, by name. */
  async integrationSettings(): Promise<Record<string, IntegrationSetting>> {
    return this.#c._field("GET", ["api", "integrations", "settings"], "settings");
  }

  /**
   * `GET /api/cli-tools`: the command-line tools found on the host's PATH.
   * Slow: the gateway runs each with `--version`.
   */
  async cliTools(): Promise<CliTool[]> {
    return this.#c._field("GET", ["api", "cli-tools"], "cli_tools");
  }

  /** `GET /api/tuis`: the terminal clients connected to the daemon. */
  async tuis(): Promise<Tui[]> {
    return this.#c._field("GET", ["api", "tuis"], "tuis");
  }

  /**
   * `GET /api/logs`: a page of structured log events, newest first.
   * Continue with `until_line_offset` set to the page's
   * `next_cursor_line_offset`.
   */
  async logs(filter: LogQuery = {}): Promise<LogPage> {
    const query: Record<string, QueryValue> = {
      since_ts: filter.since_ts,
      until_ts: filter.until_ts,
      action: filter.action,
      category: filter.category,
      outcome: filter.outcome,
      trace_id: filter.trace_id,
      q: filter.q,
      until_line_offset: filter.until_line_offset,
      severity_min: filter.severity_min || undefined,
      limit: filter.limit || undefined,
      hide_internal: filter.hide_internal ? true : undefined,
      ...filter.attributes,
    };
    return this.#c._json("GET", ["api", "logs"], { query });
  }

  /**
   * `GET /api/version/check`: whether a newer release exists. `force` skips
   * the gateway's one-hour cache; `version` checks that one tag.
   */
  async versionCheck(force = false, version?: string): Promise<VersionCheck> {
    return this.#c._json("GET", ["api", "version", "check"], {
      query: { force: force || undefined, version },
    });
  }

  /**
   * `POST /api/version/upgrade`: starts a self-upgrade to `version` (the
   * latest release without one) and returns its handoff id; follow it with
   * {@link SystemApi.upgradeStatus}. Needs `gateway.allow_self_upgrade`.
   */
  async upgrade(version?: string, autoRestart = false): Promise<string> {
    return this.#c._field("POST", ["api", "version", "upgrade"], "handoff_id", {
      json: { version: version || null, auto_restart: autoRestart },
    });
  }

  /** `GET /api/version/upgrade/status`: the progress of an upgrade, the latest without `handoffId`. */
  async upgradeStatus(handoffId?: string): Promise<UpgradeStatus> {
    return this.#c._json("GET", ["api", "version", "upgrade", "status"], {
      query: { handoff_id: handoffId },
    });
  }

  /**
   * `POST /admin/reload`: restarts the daemon's subsystems from the
   * configuration on disk. The connection drops shortly after; reconnect.
   * Allowed from loopback, or remotely with `gateway.allow_remote_admin`.
   */
  async reload(): Promise<AdminResponse> {
    return this.#c._json("POST", ["admin", "reload"]);
  }

  /** `POST /admin/shutdown`: stops the gateway. Loopback only. */
  async shutdown(): Promise<AdminResponse> {
    return this.#c._json("POST", ["admin", "shutdown"]);
  }

  /**
   * `GET /api/openapi.json`: the gateway's OpenAPI document. Public. It
   * covers the configuration, version, SOP and skill routes.
   */
  async openapi(): Promise<unknown> {
    return this.#c._json("GET", ["api", "openapi.json"]);
  }
}
