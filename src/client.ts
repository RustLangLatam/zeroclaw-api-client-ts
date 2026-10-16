/**
 * The client: a connection to one ZeroClaw gateway.
 *
 * @module
 */

import { AgentApi } from "./agents.js";
import { CanvasApi } from "./canvas.js";
import { ChannelsApi } from "./channels.js";
import { type ChatOptions, ChatSession, Feed, openSocket } from "./chat.js";
import { ConfigApi } from "./config.js";
import { CostApi } from "./cost.js";
import { CronApi } from "./cron.js";
import {
  ApiError,
  DecodeError,
  InvalidUrlError,
  RETRYABLE_STATUSES,
  RequestTimeoutError,
  TransportError,
} from "./errors.js";
import { EventsApi } from "./events.js";
import { FilesApi } from "./files.js";
import { MemoryApi } from "./memory.js";
import { PairingApi } from "./pairing.js";
import { QuickstartApi } from "./quickstart.js";
import { SessionsApi } from "./sessions.js";
import { SkillsApi } from "./skills.js";
import { SopsApi } from "./sops.js";
import { SystemApi } from "./system.js";
import { WebAuthnApi } from "./webauthn.js";
import { WebhookApi } from "./webhook.js";

/**
 * How long a request waits for the gateway's answer (its headers: a streamed
 * body is not bounded), in milliseconds. The gateway's own limit is 30 s;
 * calls that do longer work set their own.
 */
export const DEFAULT_TIMEOUT = 60_000;

/**
 * When and how often a failed idempotent request (GET, HEAD, OPTIONS, PUT,
 * DELETE) is tried again: after a connection failure, a timeout or a "try
 * again" status (408, 429, 502, 503, 504). A POST or PATCH is never retried:
 * it could apply twice.
 *
 * The wait before retry `n` (0-based) is `baseDelay * 2 ** n`, capped at
 * `maxDelay`; with `jitter`, a random point in its upper half. A
 * `Retry-After` on a 429 or 503 is honored, up to `maxDelay`.
 */
export interface RetryPolicy {
  /** How many times a request is tried again at most. Default 3. */
  maxRetries?: number;
  /** The wait before the first retry, in ms. Default 200. */
  baseDelay?: number;
  /** The cap on the wait between retries, in ms. Default 5000. */
  maxDelay?: number;
  /** Randomize each wait between half and all of its delay. Default true. */
  jitter?: boolean;
}

/** The WebSocket constructor the chat and feeds use (the standard one by default). */
export type WebSocketConstructor = new (url: string, protocols?: string | string[]) => WebSocket;

/** The options of a {@link Client}. */
export interface ClientOptions {
  /**
   * The bearer token sent with every request (obtained by pairing, see
   * {@link Client.pairing}). Without one, only public endpoints answer.
   */
  token?: string;
  /**
   * How long a request waits for the gateway's answer, in ms. It bounds the
   * headers only, so the event stream is not cut. `null` waits without
   * limit. Default {@link DEFAULT_TIMEOUT}.
   */
  timeout?: number | null;
  /** How failed idempotent requests are retried; `false` turns retries off. */
  retry?: RetryPolicy | false;
  /**
   * The `fetch` to send requests with (the global one by default): wrap it
   * for logging, tracing or request signing, or pass a mock in tests.
   */
  fetch?: typeof fetch;
  /**
   * The WebSocket constructor for the chat and the live feeds (the global
   * one by default). On Node below 22, pass one, such as the `ws` package's.
   */
  WebSocket?: WebSocketConstructor;
}

/** A query parameter; `undefined`, `null` and `""` are not sent. */
export type QueryValue = string | number | boolean | null | undefined;

/** @internal The options of one request. */
export interface RequestOptions {
  query?: Record<string, QueryValue>;
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as is. */
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Overrides the client's timeout (ms; `null` for none). */
  timeout?: number | null;
}

const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

const DEFAULT_RETRY: Required<RetryPolicy> = {
  maxRetries: 3,
  baseDelay: 200,
  maxDelay: 5000,
  jitter: true,
};

/**
 * A connection to one ZeroClaw gateway.
 *
 * ```ts
 * const client = new Client("http://127.0.0.1:42617", { token });
 * const health = await client.system.health();
 * ```
 *
 * Resource groups are reached through properties such as {@link Client.cron}
 * or {@link Client.config}. A client holds no connection of its own, so it
 * needs no closing; open chats, feeds and event streams do.
 *
 * In a browser, the gateway must be reached from the page's origin (behind
 * a proxy) or through a proxy that adds CORS headers: the gateway sends none.
 * Its token is an operator credential: keep it out of pages served to end
 * users.
 */
export class Client {
  /** The gateway's base URL, without a trailing slash. */
  readonly baseUrl: string;
  /** How long a request waits for the gateway's answer, in ms (`null`: no limit). */
  readonly timeout: number | null;
  readonly #options: ClientOptions;
  readonly #token: string | undefined;
  readonly #retry: Required<RetryPolicy>;

  /**
   * @param baseUrl The gateway's URL, e.g. `http://127.0.0.1:42617`.
   * @throws {InvalidUrlError} `baseUrl` is not an absolute http or https URL.
   */
  constructor(baseUrl: string, options: ClientOptions = {}) {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new InvalidUrlError(`${JSON.stringify(baseUrl)} is not an absolute http or https URL`);
    }
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.host) {
      throw new InvalidUrlError(`${JSON.stringify(baseUrl)} is not an absolute http or https URL`);
    }
    // Segments are appended to the base path, so it must not end in "/".
    this.baseUrl = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
    this.#options = options;
    this.#token = options.token || undefined;
    this.timeout = options.timeout === undefined ? DEFAULT_TIMEOUT : options.timeout;
    this.#retry =
      options.retry === false
        ? { ...DEFAULT_RETRY, maxRetries: 0 }
        : { ...DEFAULT_RETRY, ...options.retry };
  }

  /** A client for the same gateway and options with another bearer token, e.g. one a pairing returned. */
  withToken(token: string | undefined): Client {
    return new Client(this.baseUrl, { ...this.#options, token });
  }

  /** Whether the client sends a token. The token itself is never exposed. */
  get authenticated(): boolean {
    return this.#token !== undefined;
  }

  /** Describes the client without its token, so it never reaches logs. */
  toString(): string {
    return `Client(${this.baseUrl}, authenticated=${this.authenticated})`;
  }

  /** @internal Keeps the token out of `console.log` and `JSON.stringify`. */
  toJSON(): { baseUrl: string; authenticated: boolean } {
    return { baseUrl: this.baseUrl, authenticated: this.authenticated };
  }

  // Resource groups.

  /** One agent's endpoints: its workspace, personality files and skills. */
  agent(alias: string): AgentApi {
    return new AgentApi(this, alias);
  }

  /** The canvas endpoints (`/api/canvas`). */
  get canvas(): CanvasApi {
    return new CanvasApi(this);
  }

  /** The channel endpoints (`/api/channels`). */
  get channels(): ChannelsApi {
    return new ChannelsApi(this);
  }

  /** The configuration endpoints (`/api/config`). */
  get config(): ConfigApi {
    return new ConfigApi(this);
  }

  /** The usage and cost endpoint (`/api/cost`). */
  get cost(): CostApi {
    return new CostApi(this);
  }

  /** The scheduled jobs endpoints (`/api/cron`). */
  get cron(): CronApi {
    return new CronApi(this);
  }

  /** The live event stream endpoints (`/api/events`). */
  get events(): EventsApi {
    return new EventsApi(this);
  }

  /** The shared directory and image uploads (`/api/browse`, `/api/upload`). */
  get files(): FilesApi {
    return new FilesApi(this);
  }

  /** The long-term memory endpoints (`/api/memory`). */
  get memory(): MemoryApi {
    return new MemoryApi(this);
  }

  /** The pairing and paired devices endpoints (`/api/pair`, `/api/devices`, …). */
  get pairing(): PairingApi {
    return new PairingApi(this);
  }

  /** The first-agent quickstart endpoints (`/api/quickstart`). */
  get quickstart(): QuickstartApi {
    return new QuickstartApi(this);
  }

  /** The conversation sessions endpoints (`/api/sessions`). */
  get sessions(): SessionsApi {
    return new SessionsApi(this);
  }

  /** The skill bundles and skills (`/api/skills`). */
  get skills(): SkillsApi {
    return new SkillsApi(this);
  }

  /** The standard operating procedure endpoints (`/api/sops`). */
  get sops(): SopsApi {
    return new SopsApi(this);
  }

  /** Health, status, diagnostics, logs, versions and administration. */
  get system(): SystemApi {
    return new SystemApi(this);
  }

  /** The hardware-key registration and assertion endpoints (`/api/webauthn`). */
  get webauthn(): WebAuthnApi {
    return new WebAuthnApi(this);
  }

  /** The generic webhook and A2A endpoints (`/webhook`, `/a2a`). */
  get webhook(): WebhookApi {
    return new WebhookApi(this);
  }

  /**
   * `GET /ws/chat`: opens a chat with agent `alias` over a WebSocket and
   * waits for the gateway to confirm the session. `sessionId` resumes or
   * creates that session (a new one without it), `name` names it and `cwd`
   * is its working directory (it must exist on the host). Close the session
   * when done.
   */
  async chat(alias: string, options: ChatOptions = {}): Promise<ChatSession> {
    return ChatSession.open(this, alias, options);
  }

  // Requests.

  /** @internal The URL of `segments` under the base, each percent-encoded. */
  _url(
    segments: readonly string[],
    query?: Record<string, QueryValue>,
    base = this.baseUrl,
  ): string {
    let url = base + segments.map((s) => `/${encodeSegment(s)}`).join("");
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      params.append(key, String(value));
    }
    const search = params.toString();
    if (search) url += `?${search}`;
    return url;
  }

  /** @internal The bearer token, for the WebSocket handshake. */
  _token(): string | undefined {
    return this.#token;
  }

  /** @internal The WebSocket constructor. */
  _webSocket(): WebSocketConstructor {
    const ctor =
      this.#options.WebSocket ?? (globalThis.WebSocket as WebSocketConstructor | undefined);
    if (!ctor) {
      throw new TransportError(
        "no WebSocket in this runtime: pass one as the client's WebSocket option",
      );
    }
    return ctor;
  }

  /**
   * @internal Sends a request; a non-success status throws an
   * {@link ApiError}. The answer's body is left for the caller.
   */
  async _send(
    method: string,
    segments: readonly string[],
    options: RequestOptions = {},
  ): Promise<Response> {
    const url = this._url(segments, options.query);
    const headers: Record<string, string> = { ...options.headers };
    if (this.#token !== undefined) headers.Authorization = `Bearer ${this.#token}`;
    let body = options.body;
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers["Content-Type"] ??= "application/json";
    }
    const timeout = options.timeout === undefined ? this.timeout : options.timeout;
    const retries = IDEMPOTENT.has(method) ? this.#retry.maxRetries : 0;
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.#attempt(url, { method, headers, body: body ?? null }, timeout);
      } catch (err) {
        if (
          attempt < retries &&
          (err instanceof TransportError || err instanceof RequestTimeoutError)
        ) {
          await sleep(this.#wait(attempt, undefined));
          continue;
        }
        throw err;
      }
      if (response.ok) return response;
      if (attempt < retries && RETRYABLE_STATUSES.has(response.status)) {
        await response.body?.cancel().catch(() => {});
        await sleep(this.#wait(attempt, response));
        continue;
      }
      throw ApiError.fromResponse(response.status, await response.text().catch(() => ""));
    }
  }

  /** One try; the timeout bounds the wait for the answer's headers. */
  async #attempt(url: string, init: RequestInit, timeout: number | null): Promise<Response> {
    const doFetch = this.#options.fetch ?? globalThis.fetch;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Raced too, for a `fetch` that ignores its signal.
    const expired = new Promise<never>((_resolve, reject) => {
      if (timeout === null) return;
      timer = setTimeout(() => {
        controller.abort();
        reject(new RequestTimeoutError());
      }, timeout);
    });
    try {
      return await Promise.race([
        doFetch(url, { ...init, signal: controller.signal, redirect: "manual" }),
        expired,
      ]);
    } catch (err) {
      if (err instanceof RequestTimeoutError) throw err;
      if (controller.signal.aborted) throw new RequestTimeoutError();
      throw new TransportError(`request to the gateway failed: ${describe(err)}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  /** The wait before retry `attempt` (0-based) after `response`, in ms. */
  #wait(attempt: number, response: Response | undefined): number {
    const { baseDelay, maxDelay, jitter } = this.#retry;
    let delay = baseDelay <= 0 ? 0 : Math.min(baseDelay * 2 ** Math.min(attempt, 64), maxDelay);
    if (jitter && delay > 0) delay = delay / 2 + Math.random() * (delay / 2);
    const after = retryAfter(response, Date.now());
    return after > delay ? Math.min(after, maxDelay) : delay;
  }

  /** @internal Makes a call and returns its JSON answer (`null` for an empty body). */
  async _json<T = unknown>(
    method: string,
    segments: readonly string[],
    options?: RequestOptions,
  ): Promise<T> {
    const text = await this._text(method, segments, options);
    if (!text.trim()) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new DecodeError(`unexpected gateway response: ${describe(err)}`, { cause: err });
    }
  }

  /** @internal Makes a JSON call and returns one field of its envelope, e.g. `jobs` of `{"jobs": […]}`. */
  async _field<T>(
    method: string,
    segments: readonly string[],
    name: string,
    options?: RequestOptions,
  ): Promise<T> {
    const envelope = await this._json<unknown>(method, segments, options);
    if (envelope === null || typeof envelope !== "object" || !(name in envelope)) {
      throw new DecodeError(`unexpected gateway response: missing field ${JSON.stringify(name)}`);
    }
    return (envelope as Record<string, unknown>)[name] as T;
  }

  /** @internal Makes a call and returns its body as text. */
  async _text(
    method: string,
    segments: readonly string[],
    options?: RequestOptions,
  ): Promise<string> {
    const response = await this._send(method, segments, options);
    try {
      return await response.text();
    } catch (err) {
      throw new TransportError(
        `request to the gateway failed: reading the answer: ${describe(err)}`,
        {
          cause: err,
        },
      );
    }
  }

  /** @internal Makes a call, ignoring its body. */
  async _empty(
    method: string,
    segments: readonly string[],
    options?: RequestOptions,
  ): Promise<void> {
    await this._text(method, segments, options);
  }

  /** @internal Opens a server-push WebSocket feed on `segments`. */
  async _feed(segments: readonly string[]): Promise<Feed> {
    return new Feed(await openSocket(this, segments));
  }
}

/** Characters a path segment keeps unescaped (as Go's url.PathEscape). */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%(24|26|2B|2C|3B|3D|3A|40)/gi, (escaped) =>
    decodeURIComponent(escaped),
  );
}

/** The wait a 429 or 503 asks for in `Retry-After` (seconds or an HTTP date), in ms, or 0. */
function retryAfter(response: Response | undefined, now: number): number {
  if (!response || (response.status !== 429 && response.status !== 503)) return 0;
  const value = response.headers.get("Retry-After")?.trim() ?? "";
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - now);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @internal A thrown value's message. */
export function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
