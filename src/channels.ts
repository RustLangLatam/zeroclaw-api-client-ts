/**
 * Channels (WhatsApp, Telegram, …): their state, the identities allowed to
 * talk to them and QR logins.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api.rs` and
 * `api_config.rs` (bind). A channel is named `type.alias`, as
 * {@link ChannelsApi.list} returns it.
 *
 * @module
 */

import type { Client } from "./client.js";

/** A configured channel. */
export interface Channel {
  /** `type.alias`, the name the other calls take. */
  name: string;
  /** The channel type (`whatsapp`, `telegram`, …). */
  type: string;
  /** The alias. */
  alias: string;
  /** The agent it belongs to. */
  owning_agent?: string | null;
  /** Whether it is enabled. */
  enabled: boolean;
  /** Whether this build includes its type. */
  compiled: boolean;
  /** `active`, `inactive`, `error`, `unknown` or `not_compiled`. */
  status: string;
  /** `healthy`, `degraded`, `down` or `unavailable`. */
  health: string;
  /**
   * What it still needs (`enabled`, `bound_to_agent`, `authenticated`,
   * `listening`, each `ready`/`missing`/`unknown`, plus notes).
   */
  readiness?: unknown;
  /** The number of messages the channel has carried. */
  message_count?: number;
  /** When the last one went through (RFC 3339). */
  last_message_at?: string | null;
}

/** The result of {@link ChannelsApi.bind}. */
export interface Bound {
  /** Whether the configuration was saved. */
  saved: boolean;
  /** Whether the identity was already allowed. */
  already_bound: boolean;
  /** The peer group it was added to. */
  group: string;
  /** The channel. */
  channel: string;
}

/** The result of {@link ChannelsApi.relink}. */
export interface Relinked {
  /** The channel. */
  channel: string;
  /** `cleared` or `nothing_to_clear`. */
  outcome: string;
  /** The files removed. */
  removed?: string[] | null;
  /** Whether a reload is needed for the channel to pair again. */
  restart_required?: boolean;
  /** The gateway's note. */
  note?: string | null;
}

/** The channel endpoints (`/api/channels`), from {@link Client.channels}. */
export class ChannelsApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /api/channels`: every configured channel and its state. */
  async list(): Promise<Channel[]> {
    return this.#c._field("GET", ["api", "channels"], "channels");
  }

  /**
   * `POST /api/channels/bind`: lets `identity` talk to the channel
   * (Telegram, WeChat and LINE), adding it to the channel's peer group.
   */
  async bind(channelType: string, alias: string, identity: string): Promise<Bound> {
    return this.#c._json("POST", ["api", "channels", "bind"], {
      json: { channel_type: channelType, alias, identity },
    });
  }

  /**
   * `POST /api/channels/{channel}/relink`: clears a QR-paired channel's
   * saved login so it pairs again after a reload
   * ({@link SystemApi.reload}).
   */
  async relink(channel: string): Promise<Relinked> {
    return this.#c._json("POST", ["api", "channels", channel, "relink"]);
  }
}
