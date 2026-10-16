/**
 * Canvases: HTML, SVG, Markdown or text frames an agent (or a client)
 * publishes for display.
 *
 * Gateway handler: `crates/zeroclaw-gateway/src/canvas.rs`. Limits: 100
 * canvases, 50 frames of history each, 256 KiB per frame (the gateway's
 * 64 KiB request limit applies first).
 *
 * @module
 */

import type { Feed } from "./chat.js";
import type { Client } from "./client.js";

/** A canvas frame. */
export interface CanvasFrame {
  /** The frame id. */
  frame_id: string;
  /** `html`, `svg`, `markdown` or `text`. */
  content_type: string;
  /** The content. */
  content: string;
  /** When it was published. */
  timestamp: string;
}

/** The canvas endpoints (`/api/canvas`), from {@link Client.canvas}. */
export class CanvasApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /api/canvas`: the canvas ids. */
  async list(): Promise<string[]> {
    return this.#c._field("GET", ["api", "canvas"], "canvases");
  }

  /** `GET /api/canvas/{id}`: the current frame. */
  async current(id: string): Promise<CanvasFrame> {
    return this.#c._field("GET", ["api", "canvas", id], "frame");
  }

  /**
   * `POST /api/canvas/{id}`: publishes a frame, creating the canvas.
   * `contentType` is `html`, `svg`, `markdown` or `text`.
   */
  async publish(id: string, contentType: string, content: string): Promise<CanvasFrame> {
    return this.#c._field("POST", ["api", "canvas", id], "frame", {
      json: { content_type: contentType, content },
    });
  }

  /** `GET /api/canvas/{id}/history`: past frames, oldest first. */
  async history(id: string): Promise<CanvasFrame[]> {
    return this.#c._field("GET", ["api", "canvas", id, "history"], "frames");
  }

  /**
   * `GET /ws/canvas/{id}`: follows a canvas live. Frames are
   * `{"type": "connected" | "frame" | "lagged" | "error", …}`; a `frame`
   * carries the published frame.
   */
  async watch(id: string): Promise<Feed> {
    return this.#c._feed(["ws", "canvas", id]);
  }

  /** `DELETE /api/canvas/{id}`: clears a canvas. */
  async clear(id: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "canvas", id]);
  }
}
