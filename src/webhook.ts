/**
 * One-shot messages to an agent: the generic webhook and the A2A JSON-RPC
 * endpoint.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/lib.rs` (`handle_webhook`)
 * and `a2a.rs` (agent-to-agent). Both run a whole agent turn and answer with
 * its reply; for streaming, tool approvals or a lasting conversation use
 * {@link Client.chat}.
 *
 * @module
 */

import type { Client } from "./client.js";
import { ApiError, DecodeError } from "./errors.js";

/** An agent's reply to a webhook. */
export interface AgentReply {
  /** The reply. */
  response: string;
  /** The model that answered. */
  model: string;
}

/**
 * The answer of {@link WebhookApi.send}: the agent's reply, or `duplicate`
 * when the idempotency key was already used and nothing ran.
 */
export type WebhookReply = { duplicate: false; reply: AgentReply } | { duplicate: true };

/** The options of {@link WebhookApi.send}. */
export interface WebhookOptions {
  /** The agent to answer (the default agent without one). */
  agent?: string;
  /** Sent as `X-Webhook-Secret`, when the gateway sets `webhook_secret`. */
  secret?: string;
  /**
   * Sent as `X-Idempotency-Key`: a repeat within the gateway's window is not
   * run again, and answers `duplicate`.
   */
  idempotencyKey?: string;
  /**
   * Sent as `X-Session-Id`: it keeps calls in one conversation
   * (`[A-Za-z0-9._-]`, at most 128 characters).
   */
  sessionId?: string;
}

/** The webhook and A2A endpoints, from {@link Client.webhook}. */
export class WebhookApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `POST /webhook`: sends `message` and returns the agent's reply. */
  async send(message: string, options: WebhookOptions = {}): Promise<WebhookReply> {
    const headers: Record<string, string> = {};
    if (options.secret) headers["X-Webhook-Secret"] = options.secret;
    if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;
    if (options.sessionId) headers["X-Session-Id"] = options.sessionId;
    const raw = await this.#c._json<Record<string, unknown> | null>("POST", ["webhook"], {
      query: { agent: options.agent },
      json: { message },
      headers,
    });
    if (raw?.status === "duplicate") return { duplicate: true };
    if (raw === null || typeof raw.response !== "string") {
      throw new DecodeError('unexpected gateway response: missing field "response"');
    }
    return { duplicate: false, reply: raw as unknown as AgentReply };
  }

  /**
   * `POST /a2a/{alias}`: sends `text` to a published agent with
   * `message/send` and returns the text of its answer. A JSON-RPC error is
   * an {@link ApiError} with status 200. Needs the `a2a` feature and
   * `a2a.server.enabled` on the gateway.
   */
  async a2aSend(alias: string, text: string): Promise<string> {
    const raw = await this.#c._json<unknown>("POST", ["a2a", alias], {
      json: {
        jsonrpc: "2.0",
        id: 1,
        method: "message/send",
        params: { message: { parts: [{ kind: "text", text }] } },
      },
    });
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new DecodeError("unexpected gateway response: not a JSON-RPC object");
    }
    const answer = raw as {
      error?: { message?: unknown } | null;
      result?: { artifacts?: Array<{ parts?: Array<{ text?: unknown }> }> };
    };
    if (answer.error !== undefined && answer.error !== null) {
      const message = answer.error.message;
      throw new ApiError(200, typeof message === "string" ? message : "A2A error", raw);
    }
    const texts: string[] = [];
    for (const artifact of answer.result?.artifacts ?? []) {
      for (const part of artifact.parts ?? []) {
        if (typeof part.text === "string") texts.push(part.text);
      }
    }
    return texts.join("\n");
  }

  /** `GET /a2a/{alias}/.well-known/agent-card.json`: a published agent's A2A card. Public. */
  async agentCard(alias: string): Promise<unknown> {
    return this.#c._json("GET", ["a2a", alias, ".well-known", "agent-card.json"]);
  }

  /**
   * `GET /.well-known/agents-card.json`: the gateway's A2A catalog card,
   * whose skills list the published agents. Public. 404 when the gateway was
   * built without the `a2a` feature or `[a2a.server] enabled` is false.
   */
  async agentCatalog(): Promise<unknown> {
    return this.#c._json("GET", [".well-known", "agents-card.json"]);
  }
}
