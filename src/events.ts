/**
 * The gateway's live event stream (Server-Sent Events) and its recent history.
 *
 * Gateway handler: `crates/zeroclaw-gateway/src/sse.rs`. Every frame is
 * `data: <one JSON object>` with no event name, so frames are told apart by
 * their content: observer events and cron results carry a `type`
 * (`llm_request`, `tool_call`, `tool_call_start`, `agent_start`,
 * `agent_end`, `error`, `history_trimmed`, `cron_result`, …); structured log
 * events carry `@timestamp` instead. Frames missed while lagging are not
 * replayed.
 *
 * The stream is read from `fetch`'s body, not with `EventSource`, which
 * cannot send the bearer token.
 *
 * @module
 */

import { type Client, describe } from "./client.js";
import { DecodeError, TransportError } from "./errors.js";

/** One event, as the gateway sent it: its top-level fields. */
export type GatewayEvent = Record<string, unknown>;

/** The event's `type` (`agent_end`, `cron_result`, …); empty for log events. */
export function eventKind(event: GatewayEvent): string {
  return typeof event.type === "string" ? event.type : "";
}

/** Whether it is a structured log event (`@timestamp`, `event`, `service`, …). */
export function isLogEvent(event: GatewayEvent): boolean {
  return "@timestamp" in event;
}

/** The live event stream endpoints (`/api/events`), from {@link Client.events}. */
export class EventsApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /**
   * `GET /api/events`: opens the live stream. It ends when the gateway
   * closes the connection (e.g. on reload); subscribe again to resume. The
   * client's timeout bounds only the wait for the stream to open, never the
   * stream itself. Close the stream when done.
   */
  async subscribe(): Promise<EventStream> {
    const response = await this.#c._send("GET", ["api", "events"], {
      headers: { Accept: "text/event-stream" },
    });
    return new EventStream(response);
  }

  /**
   * `GET /api/events/history`: the latest observer events, oldest first. Up
   * to 500, kept in memory by the gateway.
   */
  async history(): Promise<GatewayEvent[]> {
    return this.#c._field("GET", ["api", "events", "history"], "events");
  }
}

/**
 * The live stream of {@link EventsApi.subscribe}.
 *
 * Iterate it with `for await`; it ends once the gateway closed the stream. A
 * frame that is not JSON throws a {@link DecodeError} from
 * {@link EventStream.next}; the stream goes on after it. Any other error ends
 * the stream.
 */
export class EventStream implements AsyncIterable<GatewayEvent> {
  readonly #reader: ReadableStreamDefaultReader<string> | undefined;
  #buffer = "";
  #done = false;

  /** @internal */
  constructor(response: Response) {
    this.#reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
    if (!this.#reader) this.#done = true;
  }

  /** The next line of the body, without its end, or `null` at its end. */
  async #line(): Promise<string | null> {
    for (;;) {
      const end = this.#buffer.search(/\r\n|\r|\n/);
      // A lone "\r" at the end of the buffer may be the first half of "\r\n".
      if (end >= 0 && !(this.#buffer[end] === "\r" && end === this.#buffer.length - 1)) {
        const line = this.#buffer.slice(0, end);
        const width = this.#buffer.startsWith("\r\n", end) ? 2 : 1;
        this.#buffer = this.#buffer.slice(end + width);
        return line;
      }
      if (this.#done || !this.#reader) {
        if (!this.#buffer) return null;
        const line = this.#buffer.replace(/\r$/, "");
        this.#buffer = "";
        return line;
      }
      let chunk: ReadableStreamReadResult<string>;
      try {
        chunk = await this.#reader.read();
      } catch (err) {
        this.#done = true;
        throw new TransportError(
          `request to the gateway failed: reading the event stream: ${describe(err)}`,
          { cause: err },
        );
      }
      if (chunk.done) this.#done = true;
      else this.#buffer += chunk.value;
    }
  }

  /** The next event, or `null` once the gateway closed the stream. */
  async next(): Promise<GatewayEvent | null> {
    const data: string[] = [];
    for (;;) {
      // "data:" lines are joined until a blank line ends the frame; comments
      // (keep-alives) and other fields are skipped. A last frame without its
      // blank line still counts.
      const line = await this.#line();
      if (line?.startsWith("data:")) {
        const value = line.slice(5);
        data.push(value.startsWith(" ") ? value.slice(1) : value);
        continue;
      }
      if (line === null && data.length === 0) return null;
      if (line || data.length === 0) continue;
      let event: unknown;
      try {
        event = JSON.parse(data.join("\n"));
      } catch (err) {
        throw new DecodeError(`event is not JSON: ${describe(err)}`);
      }
      if (event === null || typeof event !== "object" || Array.isArray(event)) {
        throw new DecodeError("event is not a JSON object");
      }
      return event as GatewayEvent;
    }
  }

  /** Closes the stream. */
  async close(): Promise<void> {
    this.#done = true;
    await this.#reader?.cancel().catch(() => {});
  }

  async *[Symbol.asyncIterator](): AsyncIterator<GatewayEvent> {
    try {
      for (;;) {
        const event = await this.next();
        if (event === null) return;
        yield event;
      }
    } finally {
      await this.close();
    }
  }
}
