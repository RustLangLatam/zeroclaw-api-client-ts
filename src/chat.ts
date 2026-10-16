/**
 * Talking to an agent over the gateway's chat WebSocket (`/ws/chat`), and
 * live feeds.
 *
 * Gateway handler: `crates/zeroclaw-gateway/src/ws.rs`. A connection is one
 * session (`gw_<sessionId>` in {@link Client.sessions}); reconnecting with
 * the same session id resumes it. Each message starts a turn that streams
 * frames (text chunks, tool calls, approval requests, …) and ends with
 * `done`, `aborted` or `error`. A message sent during a turn steers it.
 *
 * The token travels in the `Sec-WebSocket-Protocol` header
 * (`bearer.<token>`), next to ZeroClaw's subprotocol `zeroclaw.v1`, since
 * browsers cannot set an `Authorization` header on a WebSocket.
 *
 * @module
 */

import type { Client } from "./client.js";
import { DecodeError, RequestTimeoutError, TurnError, WebSocketError } from "./errors.js";

/** The WebSocket subprotocol ZeroClaw's chat speaks. */
export const SUBPROTOCOL = "zeroclaw.v1";

/**
 * Chat frame types. Frames of any other type (`plan`, `history_trimmed`,
 * `cron_result`, session events, …) keep their type and only `raw` is set.
 */
export const FrameType = {
  /** The session is open. */
  SessionStart: "session_start",
  /** Answer to a `connect` frame. */
  Connected: "connected",
  /** A piece of the reply, in `content`. */
  Chunk: "chunk",
  /** A piece of the model's reasoning, in `content`. */
  Thinking: "thinking",
  /** The agent calls a tool. */
  ToolCall: "tool_call",
  /** A tool's result. */
  ToolResult: "tool_result",
  /** The agent needs approval to run a tool. */
  ApprovalRequest: "approval_request",
  /** The turn ended; see `done`. */
  Done: "done",
  /** The turn was cancelled. */
  Aborted: "aborted",
  /** The turn (or the session) failed. */
  Error: "error",
} as const;

/** The end of a turn. */
export interface TurnResult {
  /** The whole reply. */
  full_response: string;
  /** Input tokens used. */
  input_tokens?: number | null;
  /** Output tokens used. */
  output_tokens?: number | null;
  /** Tokens used in all. */
  tokens_used?: number | null;
  /** Cost of the turn, in USD. */
  cost_usd?: number | null;
  /** The model used. */
  model?: string;
  /** The provider used. */
  provider?: string;
  /** The model's context size. */
  max_context_tokens?: number | null;
  /** The input tokens of the last model call. */
  last_input_tokens?: number | null;
}

/** A frame the gateway sends on the chat. `type` says which fields are set. */
export interface ChatFrame {
  /** The frame type, one of {@link FrameType} or another. */
  type: string;
  /** Content of a chunk or thinking frame. */
  content: string;
  /** Session id of a session_start frame. */
  sessionId: string;
  /** Whether the session existed (session_start). */
  resumed: boolean;
  /** Messages the session holds (session_start). */
  messageCount: number;
  /** Name of the session (session_start) or of the tool (tool_call, tool_result). */
  name: string;
  /** Id of a tool_call or tool_result. */
  id: string;
  /** Arguments of a tool_call. */
  args: unknown;
  /** Output of a tool_result. */
  output: unknown;
  /** Request id of an approval_request; answer it with {@link ChatSession.answerApproval}. */
  requestId: string;
  /** Tool of an approval_request. */
  tool: string;
  /** What the tool would do (approval_request). */
  argumentsSummary: string;
  /** Seconds before the approval_request is denied. */
  timeoutSecs: number;
  /** The end of the turn, for a done frame. */
  done: TurnResult | undefined;
  /** Message of an error frame. */
  message: string;
  /** Code of an error frame (`PROVIDER_ERROR`, `SESSION_QUEUE_FULL`, …). */
  code: string;
  /** The frame as sent. */
  raw: Record<string, unknown>;
}

/** Parses a chat frame; {@link DecodeError} when it is not a JSON object. */
export function parseFrame(data: string): ChatFrame {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (err) {
    throw new DecodeError(`chat frame is not JSON: ${(err as Error).message}`);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DecodeError("chat frame is not a JSON object");
  }
  const r = raw as Record<string, unknown>;
  const type = str(r, "type");
  const frame: ChatFrame = {
    type,
    content: "",
    sessionId: "",
    resumed: false,
    messageCount: 0,
    name: "",
    id: "",
    args: undefined,
    output: undefined,
    requestId: "",
    tool: "",
    argumentsSummary: "",
    timeoutSecs: 0,
    done: undefined,
    message: "",
    code: "",
    raw: r,
  };
  switch (type) {
    case FrameType.SessionStart:
      frame.sessionId = str(r, "session_id");
      frame.resumed = r.resumed === true;
      frame.messageCount = int(r, "message_count");
      frame.name = str(r, "name");
      break;
    case FrameType.Chunk:
    case FrameType.Thinking:
      frame.content = str(r, "content");
      break;
    case FrameType.ToolCall:
      frame.id = str(r, "id");
      frame.name = str(r, "name");
      frame.args = r.args;
      break;
    case FrameType.ToolResult:
      frame.id = str(r, "id");
      frame.name = str(r, "name");
      frame.output = r.output;
      break;
    case FrameType.ApprovalRequest:
      frame.requestId = str(r, "request_id");
      frame.tool = str(r, "tool");
      frame.argumentsSummary = str(r, "arguments_summary");
      frame.timeoutSecs = int(r, "timeout_secs");
      break;
    case FrameType.Done:
      frame.done = { ...(r as Partial<TurnResult>), full_response: str(r, "full_response") };
      break;
    case FrameType.Error:
      frame.message = str(r, "message") || str(r, "error") || "unknown error";
      frame.code = str(r, "code");
      break;
  }
  return frame;
}

function str(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value : "";
}

function int(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

/** An open WebSocket read one text message at a time. */
class Socket {
  readonly #ws: WebSocket;
  readonly #queue: string[] = [];
  readonly #waiters: Array<{ resolve: (v: string | null) => void; reject: (e: Error) => void }> =
    [];
  #closed = false;
  #failure: Error | undefined;

  constructor(ws: WebSocket) {
    this.#ws = ws;
    ws.addEventListener("message", (event: MessageEvent) => {
      // Binary messages are not part of ZeroClaw's protocol.
      if (typeof event.data !== "string") return;
      const waiter = this.#waiters.shift();
      if (waiter) waiter.resolve(event.data);
      else this.#queue.push(event.data);
    });
    ws.addEventListener("close", (event: CloseEvent) => {
      this.#closed = true;
      if (event.code === 1006)
        this.#failure = new WebSocketError("websocket error: connection lost");
      for (const waiter of this.#waiters.splice(0)) {
        if (this.#failure) waiter.reject(this.#failure);
        else waiter.resolve(null);
      }
    });
  }

  /** The next text message, or `null` once the socket closed. */
  protected read(): Promise<string | null> {
    const message = this.#queue.shift();
    if (message !== undefined) return Promise.resolve(message);
    if (this.#failure) {
      const failure = this.#failure;
      this.#failure = undefined;
      return Promise.reject(failure);
    }
    if (this.#closed) return Promise.resolve(null);
    return new Promise((resolve, reject) => this.#waiters.push({ resolve, reject }));
  }

  protected write(frame: Record<string, unknown>): void {
    if (this.#closed || this.#ws.readyState !== 1) {
      throw new WebSocketError("websocket error: the connection is closed");
    }
    this.#ws.send(JSON.stringify(frame));
  }

  /** Closes the connection. */
  close(): void {
    this.#ws.close(1000);
  }
}

/** The options of {@link Client.chat}. */
export interface ChatOptions {
  /** Resumes or creates this session; a new one without it. */
  sessionId?: string;
  /** Names the session. */
  name?: string;
  /** The session's working directory (it must exist on the host). */
  cwd?: string;
}

/**
 * An open chat with an agent, from {@link Client.chat}.
 *
 * Frames are read by one consumer at a time; iterate it with `for await`
 * (it ends once the socket closed). Closing during a turn cancels it.
 */
export class ChatSession extends Socket implements AsyncIterable<ChatFrame> {
  #sessionId = "";
  #resumed = false;
  #messageCount = 0;

  /** The session id (its key is `gw_<id>`). */
  get sessionId(): string {
    return this.#sessionId;
  }

  /** Whether an existing session was resumed. */
  get resumed(): boolean {
    return this.#resumed;
  }

  /** The number of messages the session held when it was opened. */
  get messageCount(): number {
    return this.#messageCount;
  }

  /** @internal Opens a chat and waits for the gateway to confirm the session. */
  static async open(client: Client, alias: string, options: ChatOptions): Promise<ChatSession> {
    const session = new ChatSession(
      await openSocket(client, ["ws", "chat"], {
        agent: alias,
        session_id: options.sessionId,
        name: options.name,
        cwd: options.cwd,
      }),
    );
    try {
      const frame = await session.next();
      if (frame === null) {
        throw new WebSocketError("the gateway closed the chat before the session started");
      }
      if (frame.type === FrameType.Error) throw new TurnError(frame.code, frame.message);
      if (frame.type !== FrameType.SessionStart) {
        throw new WebSocketError(`expected session_start, got ${JSON.stringify(frame.raw)}`);
      }
      session.#sessionId = frame.sessionId;
      session.#resumed = frame.resumed;
      session.#messageCount = frame.messageCount;
      return session;
    } catch (err) {
      session.close();
      throw err;
    }
  }

  /** Sends a message: it starts a turn, or steers the running one. */
  send(content: string): void {
    this.write({ type: "message", content });
  }

  /** Answers an approval_request with `approve`, `deny` or `always`. */
  answerApproval(requestId: string, decision: "approve" | "deny" | "always"): void {
    this.write({ type: "approval_response", request_id: requestId, decision });
  }

  /** The next frame from the gateway, or `null` once the socket closed. */
  async next(): Promise<ChatFrame | null> {
    const data = await this.read();
    return data === null ? null : parseFrame(data);
  }

  /**
   * Sends `content` and waits for the turn to end, ignoring the frames in
   * between. An error frame throws a {@link TurnError}; an aborted turn too,
   * with code `ABORTED`. Tool approvals are not answered here: iterate the
   * session for agents that ask for them.
   */
  async ask(content: string): Promise<TurnResult> {
    this.send(content);
    for (;;) {
      const frame = await this.next();
      if (frame === null)
        throw new WebSocketError("the gateway closed the chat before the turn ended");
      if (frame.type === FrameType.Done && frame.done) return frame.done;
      if (frame.type === FrameType.Error) throw new TurnError(frame.code, frame.message);
      if (frame.type === FrameType.Aborted) throw new TurnError("ABORTED", "the turn was aborted");
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<ChatFrame> {
    for (;;) {
      const frame = await this.next();
      if (frame === null) return;
      yield frame;
    }
  }
}

/**
 * A live WebSocket feed of JSON frames the gateway pushes (canvas, SOP runs).
 *
 * Iterate it with `for await`; it ends once the gateway closed the feed. A
 * frame that is not JSON throws a {@link DecodeError} from {@link Feed.next};
 * the feed goes on after it.
 */
export class Feed extends Socket implements AsyncIterable<unknown> {
  /** The next frame, or `null` once the gateway closed the feed. */
  async next(): Promise<unknown> {
    const data = await this.read();
    if (data === null) return null;
    try {
      return JSON.parse(data);
    } catch (err) {
      throw new DecodeError(`frame is not JSON: ${(err as Error).message}`);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<unknown> {
    for (;;) {
      const frame = await this.next();
      if (frame === null) return;
      yield frame;
    }
  }
}

/**
 * @internal Opens a WebSocket to `segments` on the gateway (ws for http, wss
 * for https), offering ZeroClaw's subprotocol and the bearer token. The
 * client's timeout bounds the handshake. A refused handshake (401 without a
 * valid token, 400 for an unknown agent) is a {@link WebSocketError}: the
 * WebSocket API does not expose the status.
 */
export function openSocket(
  client: Client,
  segments: readonly string[],
  query?: Record<string, string | undefined>,
): Promise<WebSocket> {
  const url = client._url(segments, query, `ws${client.baseUrl.slice(4)}`);
  const token = client._token();
  const protocols = token === undefined ? [SUBPROTOCOL] : [SUBPROTOCOL, `bearer.${token}`];
  const WebSocketCtor = client._webSocket();
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocketCtor(url, protocols);
    } catch (err) {
      reject(new WebSocketError(`websocket error: ${(err as Error).message}`, { cause: err }));
      return;
    }
    const timer =
      client.timeout === null
        ? undefined
        : setTimeout(() => {
            fail(new RequestTimeoutError());
            ws.close();
          }, client.timeout);
    const fail = (err: Error): void => {
      clearTimeout(timer);
      ws.removeEventListener("open", opened);
      ws.removeEventListener("close", closed);
      reject(err);
    };
    const opened = (): void => {
      clearTimeout(timer);
      ws.removeEventListener("close", closed);
      resolve(ws);
    };
    const closed = (event: CloseEvent): void =>
      fail(
        new WebSocketError(`websocket error: the gateway refused the connection (${event.code})`),
      );
    ws.addEventListener("open", opened, { once: true });
    ws.addEventListener("close", closed, { once: true });
  });
}
