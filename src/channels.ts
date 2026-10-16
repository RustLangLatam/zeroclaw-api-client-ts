/**
 * Channels (WhatsApp, Telegram, …): their state, sending through them,
 * group chats ("rooms") and their members, handing a message to its agent
 * again, the identities allowed to talk to them and QR logins.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api.rs` and
 * `api_config.rs` (bind). A channel is named `type.alias`, as
 * {@link ChannelsApi.list} returns it. Sending and managing rooms need
 * pairing on and the channel listed in `[gateway] send_channels`; reading
 * rooms needs pairing only. Errors on these routes carry the channel:
 * `{"channel": …, "error": …}`.
 *
 * Sending, rooms, members and redelivery are routes only the patched
 * `0.8.5+unified.18` build has (declined upstream in
 * zeroclaw-labs/zeroclaw#11434); official ZeroClaw answers them with 404.
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

/** The result of {@link ChannelsApi.redeliver}. */
export interface Redelivered {
  /** The channel. */
  channel: string;
  /** The message. */
  message_id: string;
  /** `redelivered`. */
  outcome: string;
}

/** A group chat. */
export interface RoomSummary {
  /** Id in the channel's addressing (`…@g.us` on WhatsApp). */
  id: string;
  /** Name (the WhatsApp group subject). */
  name: string;
  /** Member count. */
  participants: number;
}

/** A member of a group chat. */
export interface RoomMember {
  /** The member: `+<digits>` on WhatsApp when the number is known. */
  id: string;
  /** Whether they administer the group. */
  admin: boolean;
}

/** What happened to someone added to a group chat. */
export interface Participant {
  /** Who. */
  user: string;
  /** `added`, `invited`, `refused` or `failed`. */
  outcome: string;
  /** Why, when it did not work. */
  detail?: string | null;
}

/** The result of {@link ChannelsApi.createRoom}. */
export interface CreatedRoom {
  /** The channel. */
  channel: string;
  /** The new room's id. */
  room: string;
  /** Always `created`. */
  outcome: string;
  /** What happened to each invitee. */
  participants?: Participant[];
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

  /** `POST /api/channels/{channel}/send`: sends plain text to `to`, with no agent turn. */
  async send(channel: string, to: string, content: string, threadId?: string): Promise<void> {
    await this.#c._empty("POST", ["api", "channels", channel, "send"], {
      json: { to, content, thread_id: threadId ?? null },
    });
  }

  /**
   * `POST /api/channels/{channel}/messages/{message_id}/redeliver`: hands a
   * received message to its agent again, unchanged, as a new turn that runs
   * after any turn already running for that sender. The gateway keeps only
   * recent inbound messages, in memory: one it no longer keeps answers 404
   * (`isNotFound`). `messageId` is the one MCP calls carry as
   * `_meta["zeroclaw/message_id"]` (for email, the Message-ID without angle
   * brackets).
   */
  async redeliver(channel: string, messageId: string): Promise<Redelivered> {
    return this.#c._json("POST", ["api", "channels", channel, "messages", messageId, "redeliver"]);
  }

  /** `GET /api/channels/{channel}/rooms`: the group chats the running channel takes part in. */
  async rooms(channel: string): Promise<RoomSummary[]> {
    return this.#c._field("GET", ["api", "channels", channel, "rooms"], "rooms");
  }

  /**
   * `POST /api/channels/{channel}/rooms`: creates a group chat and invites
   * `invites` (phone numbers on WhatsApp, which are also allowed to talk to
   * the channel).
   */
  async createRoom(
    channel: string,
    name: string,
    topic?: string,
    invites: readonly string[] = [],
  ): Promise<CreatedRoom> {
    return this.#c._json("POST", ["api", "channels", channel, "rooms"], {
      json: { name, topic: topic ?? null, invites },
    });
  }

  /** `GET /api/channels/{channel}/rooms/{room}/members`: a group chat's members. */
  async roomMembers(channel: string, room: string): Promise<RoomMember[]> {
    return this.#c._field("GET", ["api", "channels", channel, "rooms", room, "members"], "members");
  }

  /** `POST /api/channels/{channel}/rooms/{room}/invites`: adds or invites `user` to a group chat. */
  async invite(channel: string, room: string, user: string): Promise<Participant> {
    return this.#c._json("POST", ["api", "channels", channel, "rooms", room, "invites"], {
      json: { user },
    });
  }

  /** `DELETE /api/channels/{channel}/rooms/{room}/members/{user}`: removes a member from a group chat. */
  async removeMember(channel: string, room: string, user: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "channels", channel, "rooms", room, "members", user]);
  }
}
