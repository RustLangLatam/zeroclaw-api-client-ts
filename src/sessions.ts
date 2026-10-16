/**
 * Conversation sessions: listing, transcripts, state, renaming, aborting and
 * adding messages.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api.rs` (`/api/sessions*`).
 * A session id is either the display id or the full session key (`gw_…`,
 * `whatsapp_…`); the gateway resolves both.
 *
 * @module
 */

import type { Client } from "./client.js";

/** A stored session. */
export interface Session {
  /** The display id (`gw_` removed). */
  session_id: string;
  /** The full key (`gw_…`, `whatsapp_<channel>_<peer>…`). */
  session_key?: string | null;
  /** The creation time (RFC 3339). */
  created_at: string;
  /** The last activity (RFC 3339). */
  last_activity: string;
  /** The number of messages in it. */
  message_count: number;
  /** The agent that answers it. */
  agent_alias?: string | null;
  /** The channel it came through (`whatsapp.alias`). */
  channel_id?: string | null;
  /** The name given to it. */
  name?: string | null;
}

/** A message of a transcript. */
export interface SessionMessage {
  /** `user`, `assistant`, `tool`, … */
  role: string;
  /** The content (tool calls and results are JSON text). */
  content: string;
  /** When it was stored. */
  created_at?: string | null;
}

/** Whether a session is busy. */
export interface SessionState {
  /** The session id as asked. */
  session_id: string;
  /** `idle`, `running` or `error`. */
  state: string;
  /** The running turn. */
  turn_id?: string | null;
  /** When it started. */
  turn_started_at?: string | null;
}

/** The session endpoints (`/api/sessions`), from {@link Client.sessions}. */
export class SessionsApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /api/sessions`: every stored session, empty when the gateway keeps none. */
  async list(): Promise<Session[]> {
    return this.#c._field("GET", ["api", "sessions"], "sessions");
  }

  /** `GET /api/sessions/running`: the gateway (web chat) sessions. */
  async running(): Promise<Session[]> {
    return this.#c._field("GET", ["api", "sessions", "running"], "sessions");
  }

  /** `GET /api/sessions/{id}/messages`: the transcript, empty for an unknown session. */
  async messages(id: string): Promise<SessionMessage[]> {
    return this.#c._field("GET", ["api", "sessions", id, "messages"], "messages");
  }

  /**
   * `POST /api/sessions/{id}/messages`: appends an assistant message to the
   * session, shown to chat clients. No agent turn runs.
   */
  async addMessage(id: string, content: string): Promise<void> {
    await this.#c._empty("POST", ["api", "sessions", id, "messages"], { json: { content } });
  }

  /** `GET /api/sessions/{id}/state`: whether a turn is running. */
  async state(id: string): Promise<SessionState> {
    return this.#c._json("GET", ["api", "sessions", id, "state"]);
  }

  /** `PUT /api/sessions/{id}`: renames a session. */
  async rename(id: string, name: string): Promise<void> {
    await this.#c._empty("PUT", ["api", "sessions", id], { json: { name } });
  }

  /** `DELETE /api/sessions/{id}`: cancels its running turn and deletes it. */
  async delete(id: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "sessions", id]);
  }

  /** `POST /api/sessions/{id}/abort`: cancels the running turn and reports whether there was one. */
  async abort(id: string): Promise<boolean> {
    const status = await this.#c._field<string>("POST", ["api", "sessions", id, "abort"], "status");
    return status === "aborted";
  }
}
