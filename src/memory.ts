/**
 * Long-term memory: entries the agents store and recall.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api.rs` (`/api/memory*`);
 * entry type in `crates/zeroclaw-api/src/memory_traits.rs`.
 *
 * @module
 */

import type { Client } from "./client.js";

/** A memory entry. */
export interface MemoryEntry {
  /** The entry id. */
  id: string;
  /** The key. */
  key: string;
  /** The content. */
  content: string;
  /** The category. */
  category: string;
  /** When it was stored. */
  timestamp: string;
  /** The session it came from. */
  session_id?: string | null;
  /** The relevance of a recall match. */
  score?: number | null;
  /** The namespace. */
  namespace?: string | null;
  /** The importance. */
  importance?: number | null;
  /** The entry that replaced it. */
  superseded_by?: string | null;
  /** `"episodic"`, `"procedural"` or `{"semantic": "fact" | …}`. */
  kind?: unknown;
  /** Whether it is pinned. */
  pinned?: boolean;
  /** The owning agent. */
  agent_alias?: string | null;
}

/** The filters of {@link MemoryApi.search}. */
export interface MemorySearch {
  /** Text to match. */
  query?: string;
  /** `core`, `daily`, `conversation` or custom. */
  category?: string;
  /** Entries stored at or after (RFC 3339). */
  since?: string;
  /** Entries stored before (RFC 3339). */
  until?: string;
  /** Search this agent's memory instead of the shared one. */
  agent?: string;
}

/** The long-term memory endpoints (`/api/memory`), from {@link Client.memory}. */
export class MemoryApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /**
   * `GET /api/memory`: searches the memory. With a text (`query`) or time
   * (`since`, `until`) filter, the best matches (at most 50); otherwise every
   * entry (of `category`, when set). Contents longer than 4096 characters
   * come truncated.
   */
  async search(filter: MemorySearch = {}): Promise<MemoryEntry[]> {
    return this.#c._field("GET", ["api", "memory"], "entries", { query: { ...filter } });
  }

  /**
   * `POST /api/memory`: stores `content` under `key`, in category `core`
   * unless `category` is set, and in `agent`'s memory or, without one, the
   * shared one.
   */
  async store(key: string, content: string, category?: string, agent?: string): Promise<void> {
    await this.#c._empty("POST", ["api", "memory"], {
      json: { key, content, category: category || null, agent: agent || null },
    });
  }

  /**
   * `DELETE /api/memory/{key}`: forgets an entry, from `agent`'s memory or
   * the shared one, and reports whether it existed.
   */
  async forget(key: string, agent?: string): Promise<boolean> {
    return this.#c._field("DELETE", ["api", "memory", key], "deleted", { query: { agent } });
  }
}
