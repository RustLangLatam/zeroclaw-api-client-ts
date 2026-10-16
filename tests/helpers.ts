// The mock gateway the tests talk to: a `fetch` that records each request
// and answers from a handler, and a WebSocket stand-in.

import { Client, type ClientOptions } from "../src/index.js";

export const TOKEN = "zc_test_token";

/** A request as the mock gateway saw it. */
export interface Seen {
  method: string;
  url: URL;
  headers: Headers;
  /** The body text; binary bodies are recorded as their bytes. */
  body: string | Uint8Array | undefined;
}

export type Handler = (request: Seen) => Response | Promise<Response>;

/** A JSON answer. */
export function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** A client whose requests go to `handler`, with retries that do not wait. */
export function gateway(
  handler: Handler,
  options: ClientOptions = {},
): { client: Client; requests: Seen[] } {
  const requests: Seen[] = [];
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const body = init.body;
    const seen: Seen = {
      method: init.method ?? "GET",
      url: new URL(String(input)),
      headers: new Headers(init.headers),
      body:
        body === null || body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : new Uint8Array(await new Response(body).arrayBuffer()),
    };
    requests.push(seen);
    return handler(seen);
  };
  const client = new Client("http://gw.test", {
    token: TOKEN,
    fetch: fetch as typeof globalThis.fetch,
    retry: { baseDelay: 0, jitter: false },
    ...options,
  });
  return { client, requests };
}

/** The query of a request, as an object. */
export function query(seen: Seen): Record<string, string> {
  return Object.fromEntries(seen.url.searchParams);
}

/**
 * A WebSocket stand-in: the test plays the gateway through `serve`, which
 * gets each opened socket.
 */
export function fakeWebSocket(serve: (socket: FakeSocket) => void): typeof WebSocket {
  class Fake extends EventTarget {
    readyState = 0;
    readonly sent: string[] = [];
    constructor(
      readonly url: string,
      readonly protocols: string[] = [],
    ) {
      super();
      queueMicrotask(() => serve(new FakeSocket(this)));
    }
    send(data: string): void {
      this.sent.push(data);
      this.dispatchEvent(new MessageEvent("sent", { data }));
    }
    close(code = 1000): void {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.dispatchEvent(new CloseEventShim(code));
    }
  }
  return Fake as unknown as typeof WebSocket;
}

class CloseEventShim extends Event {
  constructor(readonly code: number) {
    super("close");
  }
}

/** The gateway's side of a fake socket. */
export class FakeSocket {
  constructor(
    readonly ws: EventTarget & {
      readyState: number;
      url: string;
      protocols: string[];
      sent: string[];
      close(code?: number): void;
    },
  ) {}

  /** Completes the handshake. */
  open(): void {
    this.ws.readyState = 1;
    this.ws.dispatchEvent(new Event("open"));
  }

  /**
   * Pushes a frame to the client. Like a real socket, each message arrives
   * in its own task, in order.
   */
  push(frame: unknown): void {
    const data = typeof frame === "string" ? frame : JSON.stringify(frame);
    setTimeout(() => this.ws.dispatchEvent(new MessageEvent("message", { data })));
  }

  /** Calls `answer` with each frame the client sends. */
  onSend(answer: (frame: Record<string, unknown>) => void): void {
    this.ws.addEventListener("sent", (event) => answer(JSON.parse((event as MessageEvent).data)));
  }

  /** Closes the socket from the gateway's side, after the frames pushed before. */
  close(code = 1000): void {
    setTimeout(() => this.ws.close(code));
  }
}
