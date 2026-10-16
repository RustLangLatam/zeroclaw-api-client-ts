/**
 * A typed, resilient client for the ZeroClaw gateway: its HTTP API, its
 * Server-Sent Events stream and its WebSocket chat. It runs wherever `fetch`
 * does: browsers, Node 18+, Deno, Bun and edge runtimes.
 *
 * ```ts
 * import { Client } from "zeroclaw-api-client";
 *
 * const client = new Client("http://127.0.0.1:42617", { token: "zc_…" });
 * const status = await client.system.status();
 * ```
 *
 * @module
 */

export * from "./agents.js";
export * from "./canvas.js";
export * from "./channels.js";
export {
  type ChatFrame,
  type ChatOptions,
  ChatSession,
  Feed,
  FrameType,
  parseFrame,
  SUBPROTOCOL,
  type TurnResult,
} from "./chat.js";
export {
  Client,
  type ClientOptions,
  DEFAULT_TIMEOUT,
  type QueryValue,
  type RetryPolicy,
  type WebSocketConstructor,
} from "./client.js";
export * from "./config.js";
export * from "./cost.js";
export * from "./cron.js";
export * from "./errors.js";
export * from "./events.js";
export * from "./files.js";
export * from "./memory.js";
export * from "./pairing.js";
export * from "./quickstart.js";
export * from "./sessions.js";
export * from "./skills.js";
export * from "./sops.js";
export * from "./system.js";
export { VERSION } from "./version.js";
export * from "./webauthn.js";
export * from "./webhook.js";
