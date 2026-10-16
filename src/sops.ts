/**
 * Standard operating procedures (SOPs): authoring, graphs, runs, approvals
 * and cancellation.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api_sop_author.rs` and
 * `api_sop.rs`. An SOP definition (name, description, version, priority,
 * execution_mode, triggers, steps, …) is large and versioned with ZeroClaw,
 * so it travels as decoded JSON (`unknown`); so do graphs and run overlays.
 * Every route answers 503 while the SOP subsystem is disabled.
 *
 * @module
 */

import type { Feed } from "./chat.js";
import type { Client } from "./client.js";

/**
 * An answer to a waiting SOP run, encoded externally tagged as the gateway
 * expects. Build it with {@link Decision}.
 */
export type SopDecision =
  | "approve"
  | { deny: { reason?: string } }
  | { amend: { text: string } }
  | { revise: { guidance: string } };

/** Builders of {@link SopDecision}. */
export const Decision = {
  /** Go on. */
  approve: (): SopDecision => "approve",
  /** Stop the run; `reason` may be empty. */
  deny: (reason = ""): SopDecision => ({ deny: reason ? { reason } : {} }),
  /** Change the checkpoint's text and go on. */
  amend: (text: string): SopDecision => ({ amend: { text } }),
  /** Redo the step with `guidance`. */
  revise: (guidance: string): SopDecision => ({ revise: { guidance } }),
} as const;

/** A run in a listing. */
export interface SopRun {
  /** The run id. */
  run_id: string;
  /** The SOP. */
  sop_name: string;
  /**
   * `pending`, `running`, `cancel_requested`, `waiting_approval`,
   * `paused_checkpoint`, `completed`, `failed` or `cancelled`.
   */
  status: string;
  /** The current step. */
  current_step: number;
  /** The number of steps in all. */
  total_steps: number;
  /** The start (RFC 3339). */
  started_at: string;
  /** The end. */
  completed_at?: string | null;
  /** What started it. */
  trigger_source: string;
  /** Whether it is still running. */
  active: boolean;
}

/** A run waiting for an operator. */
export interface PendingApproval {
  /** The run id. */
  run_id: string;
  /** The SOP. */
  sop_name: string;
  /** The step waiting. */
  step: number;
  /** The number of steps in all. */
  total_steps: number;
  /** Since when. */
  waiting_since?: string | null;
  /** `approval` or `checkpoint`. */
  kind: string;
}

/** The standard operating procedure endpoints (`/api/sops`), from {@link Client.sops}. */
export class SopsApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /api/sops`: every SOP definition that loads. */
  async list(): Promise<unknown[]> {
    return this.#c._field("GET", ["api", "sops"], "sops");
  }

  /** `GET /api/sops/{name}/full`: one SOP definition. */
  async get(name: string): Promise<unknown> {
    return this.#c._json("GET", ["api", "sops", name, "full"]);
  }

  /** `POST /api/sops`: creates an SOP, 409 when the name exists. */
  async create(sop: unknown): Promise<void> {
    await this.#c._empty("POST", ["api", "sops"], { json: sop });
  }

  /** `PUT /api/sops/{name}`: saves an SOP; steps are renumbered 1..N. */
  async save(name: string, sop: unknown): Promise<void> {
    await this.#c._empty("PUT", ["api", "sops", name], { json: sop });
  }

  /** `DELETE /api/sops/{name}`: deletes an SOP. */
  async delete(name: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "sops", name]);
  }

  /** `GET /api/sops/{name}/graph`: the SOP as a node graph, with layout and diagnostics. */
  async graph(name: string): Promise<unknown> {
    return this.#c._json("GET", ["api", "sops", name, "graph"]);
  }

  /** `POST /api/sops/graph-draft`: the graph of an unsaved definition. */
  async graphDraft(sop: unknown): Promise<unknown> {
    return this.#c._json("POST", ["api", "sops", "graph-draft"], { json: { sop } });
  }

  /**
   * `POST /api/sops/wire-draft`: applies a wiring edit to an unsaved
   * definition. `edit` is `{op: "connect" | "disconnect", from, to, role,
   * port?}`. Returns `{sop, graph}`.
   */
  async wireDraft(sop: unknown, edit: unknown): Promise<unknown> {
    return this.#c._json("POST", ["api", "sops", "wire-draft"], { json: { sop, edit } });
  }

  /** `GET /api/sops/graph-legend`: what the graph's roles, pins and run states mean. */
  async graphLegend(): Promise<unknown> {
    return this.#c._json("GET", ["api", "sops", "graph-legend"]);
  }

  /** `GET /api/sops/trigger-sources`: the trigger sources, their fields and the channels that can start an SOP. */
  async triggerSources(): Promise<unknown> {
    return this.#c._json("GET", ["api", "sops", "trigger-sources"]);
  }

  /**
   * `POST /api/sops/{name}/run`: starts the SOP through its manual trigger.
   * `payload` is JSON text handed to the run. Returns the run id (an
   * existing run's when the SOP coalesces).
   */
  async run(name: string, payload?: string): Promise<string> {
    return this.#c._field("POST", ["api", "sops", name, "run"], "run_id", {
      json: { payload: payload || null },
    });
  }

  /** `GET /api/sops/runs`: active and recent runs, newest first, of one SOP when `sop` is set. */
  async runs(sop?: string): Promise<SopRun[]> {
    return this.#c._field("GET", ["api", "sops", "runs"], "runs", { query: { sop } });
  }

  /**
   * `GET /ws/sops/runs`: follows SOP runs live. A
   * `{"type": "snapshot", "runs": […]}` first, then
   * `{"type": "run", "run": …}` on every change (lagged, disabled and error
   * frames too).
   */
  async watchRuns(): Promise<Feed> {
    return this.#c._feed(["ws", "sops", "runs"]);
  }

  /** `GET /api/sops/{name}/runs/{run_id}/overlay`: a run's state per step, with its tool calls. */
  async runOverlay(name: string, runId: string): Promise<unknown> {
    return this.#c._json("GET", ["api", "sops", name, "runs", runId, "overlay"]);
  }

  /**
   * `POST /api/sops/{name}/runs/{run_id}/decide`: answers a run waiting for
   * approval or at a checkpoint; returns the run overlay.
   */
  async decide(name: string, runId: string, decision: SopDecision): Promise<unknown> {
    return this.#c._json("POST", ["api", "sops", name, "runs", runId, "decide"], {
      json: decision,
    });
  }

  /** `POST /api/sops/{name}/runs/{run_id}/cancel`: cancels a run at its next step boundary. */
  async cancel(name: string, runId: string, reason?: string): Promise<unknown> {
    return this.#c._json("POST", ["api", "sops", name, "runs", runId, "cancel"], {
      json: { reason: reason || null },
    });
  }

  /** `GET /admin/sop/pending`: the runs waiting for an approval or a checkpoint. Loopback, or remote admin with pairing. */
  async pending(): Promise<PendingApproval[]> {
    return this.#c._field("GET", ["admin", "sop", "pending"], "pending");
  }

  /**
   * `POST /admin/sop/approve`: approves a waiting run. Returns the outcome
   * (`resumed`, `already_resolved`, `pending_quorum (…)`, …).
   */
  async approve(runId: string): Promise<string> {
    return this.#resolve("approve", runId, undefined);
  }

  /** `POST /admin/sop/deny`: denies a waiting run; returns the outcome. */
  async deny(runId: string, reason?: string): Promise<string> {
    return this.#resolve("deny", runId, reason);
  }

  async #resolve(action: string, runId: string, reason: string | undefined): Promise<string> {
    return this.#c._field("POST", ["admin", "sop", action], "outcome", {
      json: { run_id: runId, reason: reason || null },
    });
  }
}
