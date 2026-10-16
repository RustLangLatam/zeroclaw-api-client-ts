/**
 * Model usage and its cost.
 *
 * Gateway handler: `crates/zeroclaw-gateway/src/api.rs` (`/api/cost`);
 * types in `crates/zeroclaw-config/src/cost/types.rs`.
 *
 * @module
 */

import type { Client } from "./client.js";

/** One model's usage. */
export interface ModelStats {
  /** The model. */
  model: string;
  /** The cost, USD. */
  cost_usd: number;
  /** The input tokens. */
  input_tokens: number;
  /** The cached input tokens. */
  cached_input_tokens: number;
  /** The output tokens. */
  output_tokens: number;
  /** All tokens. */
  total_tokens: number;
  /** The calls. */
  request_count: number;
}

/** One agent's usage. */
export interface AgentCostStats {
  /** The agent. */
  agent_alias: string;
  /** The cost, USD. */
  cost_usd: number;
  /** All tokens. */
  total_tokens: number;
  /** The input tokens. */
  input_tokens: number;
  /** The output tokens. */
  output_tokens: number;
  /** The cached input tokens. */
  cached_input_tokens: number;
  /** The calls. */
  request_count: number;
}

/** Usage totals. */
export interface CostSummary {
  /** The cost of the current session, USD. */
  session_cost_usd: number;
  /** The cost today, USD. */
  daily_cost_usd: number;
  /** The cost this month, USD. */
  monthly_cost_usd: number;
  /** The tokens in the window. */
  total_tokens: number;
  /** The model calls in the window. */
  request_count: number;
  /** The usage by model. */
  by_model?: Record<string, ModelStats> | null;
  /** The usage by agent. */
  by_agent?: Record<string, AgentCostStats> | null;
}

/** The usage and cost endpoint (`/api/cost`), from {@link Client.cost}. */
export class CostApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /**
   * `GET /api/cost`: the usage in `[from, to)`, broken down by model and by
   * agent. Bounds are RFC 3339; an unset one leaves the window open on that
   * side.
   */
  async summary(from?: string, to?: string): Promise<CostSummary> {
    return this.#c._field("GET", ["api", "cost"], "cost", { query: { from, to } });
  }

  /** `GET /api/cost`: one agent's session and daily figures (the gateway ignores a time window here). */
  async agent(agent: string): Promise<CostSummary> {
    return this.#c._field("GET", ["api", "cost"], "cost", { query: { agent } });
  }
}
