/**
 * Scheduled jobs: shell commands or agent prompts on a cron schedule, their
 * results delivered to a channel.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api.rs` (`/api/cron*`);
 * types in `crates/zeroclaw-runtime/src/cron/types.rs`.
 *
 * @module
 */

import type { Client } from "./client.js";

/** How long a manual run may take, in ms: the gateway allows 600 s. */
export const CRON_LONG_RUN = 660_000;

/** When a job runs, told apart by `kind`. */
export type Schedule =
  /** On a cron expression, in a time zone (UTC when unset). */
  | { kind: "cron"; expr: string; tz?: string | null }
  /** Once, at a time (RFC 3339). */
  | { kind: "at"; at: string }
  /** Every `every_ms` milliseconds. */
  | { kind: "every"; every_ms: number };

/** Where a job's output goes. */
export interface Delivery {
  /** `none` or `announce` (post it on a channel). */
  mode: string;
  /** The channel, as `type.alias`. */
  channel?: string | null;
  /** The recipient on the channel. */
  to?: string | null;
  /** The thread to post in. */
  thread_id?: string | null;
  /** Whether a delivery failure leaves the run successful. */
  best_effort?: boolean;
}

/** A delivery that posts the output to `to` on `channel` (`type.alias`). */
export function announce(channel: string, to: string): Delivery {
  return { mode: "announce", channel, to, best_effort: true };
}

/** A scheduled job. */
export interface CronJob {
  /** The job id. */
  id: string;
  /** The schedule expression as written. */
  expression: string;
  /** The parsed schedule. */
  schedule: Schedule;
  /** The shell command (shell jobs). */
  command?: string;
  /** The prompt (agent jobs). */
  prompt?: string | null;
  /** The name. */
  name?: string | null;
  /** `shell` or `agent`. */
  job_type: string;
  /** `isolated` or `main`. */
  session_target: string;
  /** The model override (agent jobs). */
  model?: string | null;
  /** The agent that owns it. */
  agent_alias: string;
  /** Whether it runs. */
  enabled: boolean;
  /** Where its output goes. */
  delivery: Delivery;
  /** Whether it is deleted after one run. */
  delete_after_run: boolean;
  /** The tools an agent job may use (`null`: no restriction). */
  allowed_tools?: string[] | null;
  /** Whether an agent job uses memory. */
  uses_memory?: boolean;
  /** `imperative` (API, CLI) or `declarative` (config file). */
  source?: string;
  /** `wrapped` or `raw` (shell jobs). */
  shell_output_format?: string | null;
  /** The creation time (RFC 3339). */
  created_at: string;
  /** The next run (RFC 3339). */
  next_run: string;
  /** The last run (RFC 3339). */
  last_run?: string | null;
  /** The last status. */
  last_status?: string | null;
  /** The last output. */
  last_output?: string | null;
}

/**
 * A job to create. Shell jobs need `command`; agent jobs `prompt` (and
 * `job_type` `agent`, implied by a prompt). Unset fields are left out.
 */
export interface NewCronJob {
  /** The owning agent (must be configured). */
  agent: string;
  /** The cron expression. */
  schedule: string;
  /** The name. */
  name?: string;
  /** The IANA time zone of the schedule. */
  tz?: string;
  /** The shell command. */
  command?: string;
  /** `shell` or `agent`. */
  job_type?: string;
  /** The agent prompt. */
  prompt?: string;
  /** Where the output goes. */
  delivery?: Delivery;
  /** `isolated` (default) or `main`. */
  session_target?: string;
  /** The model override. */
  model?: string;
  /** The tools an agent job may use (unset: no restriction; `[]`: none). */
  allowed_tools?: string[];
  /** Delete the job after its first run. */
  delete_after_run?: boolean;
  /** Whether an agent job uses memory (default true). */
  uses_memory?: boolean;
  /** `wrapped` (default) or `raw`: how a shell job's output is announced. */
  shell_output_format?: string;
}

/** Changes to a job; unset fields stay as they are. */
export interface CronJobPatch {
  /** The owning agent; required when changing a shell job's command. */
  agent?: string;
  /** The name. */
  name?: string;
  /** The cron expression. */
  schedule?: string;
  /** The IANA time zone. */
  tz?: string;
  /** Remove the time zone. */
  clear_tz?: boolean;
  /** The shell command (or an agent job's prompt). */
  command?: string;
  /** The agent prompt. */
  prompt?: string;
  /** Pause (false) or resume the job. */
  enabled?: boolean;
  /** Whether an agent job uses memory. */
  uses_memory?: boolean;
  /** `wrapped` or `raw`. */
  shell_output_format?: string;
}

/** The result of {@link CronApi.run}. */
export interface CronRunResult {
  /** The run status. */
  status: string;
  /** The job id. */
  job_id: string;
  /** Whether the job succeeded. */
  success: boolean;
  /** Its output. */
  output: string;
  /** The duration, in milliseconds. */
  duration_ms: number;
  /** The start (RFC 3339). */
  started_at: string;
  /** The end (RFC 3339). */
  finished_at: string;
}

/** A recorded run. */
export interface CronRun {
  /** The run id. */
  id: number;
  /** The job id. */
  job_id: string;
  /** The start (RFC 3339). */
  started_at: string;
  /** The end (RFC 3339). */
  finished_at: string;
  /** The status. */
  status: string;
  /** The output. */
  output?: string | null;
  /** The duration, in milliseconds. */
  duration_ms?: number | null;
}

/** The scheduler settings. */
export interface CronSettings {
  /** Whether the scheduler runs jobs. */
  enabled: boolean;
  /** Whether missed runs run at startup. */
  catch_up_on_startup: boolean;
  /** The number of runs kept per job. */
  max_run_history: number;
}

/** The scheduled jobs endpoints (`/api/cron`), from {@link Client.cron}. */
export class CronApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /api/cron`: every job. */
  async list(): Promise<CronJob[]> {
    return this.#c._field("GET", ["api", "cron"], "jobs");
  }

  /** `POST /api/cron`: creates a job. */
  async create(job: NewCronJob): Promise<CronJob> {
    return this.#c._field("POST", ["api", "cron"], "job", { json: job });
  }

  /** `PATCH /api/cron/{id}`: changes a job; unset fields stay as they are. */
  async update(id: string, patch: CronJobPatch): Promise<CronJob> {
    return this.#c._field("PATCH", ["api", "cron", id], "job", { json: patch });
  }

  /** `DELETE /api/cron/{id}`: deletes a job. */
  async delete(id: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "cron", id]);
  }

  /**
   * `POST /api/cron/{id}/run`: runs a job now and waits for it. The gateway
   * allows up to its long-running timeout, 600 s by default. A failed job
   * still throws nothing, with `success` false.
   */
  async run(id: string): Promise<CronRunResult> {
    return this.#c._json("POST", ["api", "cron", id, "run"], { timeout: CRON_LONG_RUN });
  }

  /** `GET /api/cron/{id}/runs`: the job's latest runs; `limit` is 1 to 100 (gateway default 20). */
  async runs(id: string, limit?: number): Promise<CronRun[]> {
    return this.#c._field("GET", ["api", "cron", id, "runs"], "runs", { query: { limit } });
  }

  /** `GET /api/cron/settings`: the scheduler settings. */
  async settings(): Promise<CronSettings> {
    return this.#c._json("GET", ["api", "cron", "settings"]);
  }

  /** `PATCH /api/cron/settings`: changes the scheduler settings that are set; saved to the configuration. */
  async updateSettings(settings: Partial<CronSettings>): Promise<CronSettings> {
    return this.#c._json("PATCH", ["api", "cron", "settings"], { json: settings });
  }
}
