/**
 * The quickstart: setting up a first agent in one submission (model
 * provider, risk and runtime profiles, memory, channels and personality).
 *
 * Gateway handler: `crates/zeroclaw-gateway/src/api_quickstart.rs`;
 * submission type `BuilderSubmission` in
 * `crates/zeroclaw-config/src/presets.rs`. Validation problems come back in
 * a successful answer (`{"kind": "errors", …}`), not as HTTP errors.
 *
 * @module
 */

import type { Client } from "./client.js";

/** The quickstart endpoints (`/api/quickstart`), from {@link Client.quickstart}. */
export class QuickstartApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /**
   * `GET /api/quickstart/state`: what exists and what can be chosen
   * (provider and channel types, presets, memory kinds, …).
   */
  async state(): Promise<unknown> {
    return this.#c._json("GET", ["api", "quickstart", "state"]);
  }

  /**
   * `POST /api/quickstart/fields`: the fields a section of type `typeKey`
   * needs. `section` is `model_provider`, `channel` or `peer_group`.
   */
  async fields(section: string, typeKey: string): Promise<unknown> {
    return this.#c._json("POST", ["api", "quickstart", "fields"], {
      json: { section, type_key: typeKey },
    });
  }

  /**
   * `POST /api/quickstart/validate`: checks a submission. Answers
   * `{"kind": "ok"}` or `{"kind": "errors", "errors": […]}`.
   */
  async validate(submission: unknown): Promise<unknown> {
    return this.#c._json("POST", ["api", "quickstart", "validate"], { json: submission });
  }

  /**
   * `POST /api/quickstart/apply`: saves a submission. On
   * `{"kind": "applied", …, "daemon_restarted": true}` the gateway drops
   * connections briefly while it reloads.
   */
  async apply(submission: unknown): Promise<unknown> {
    return this.#c._json("POST", ["api", "quickstart", "apply"], { json: submission });
  }

  /**
   * `POST /api/quickstart/dismiss`: records that the quickstart was closed.
   * `surface` is `web`, `tui`, `cli` or `test`.
   */
  async dismiss(runId: string, surface: string, lastStep?: string): Promise<void> {
    await this.#c._empty("POST", ["api", "quickstart", "dismiss"], {
      json: { run_id: runId, surface, last_step: lastStep || null },
    });
  }
}
