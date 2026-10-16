/**
 * The shared directory (`<install>/shared/`) and image uploads.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api_browse.rs` and
 * `api_upload.rs`. Per-agent workspaces are in `AgentApi`.
 *
 * @module
 */

import type { Client } from "./client.js";

/** A directory entry. */
export interface FileEntry {
  /** The entry's name. */
  name: string;
  /** `dir` or `file`. */
  kind: string;
  /** The size of a file. */
  size?: number | null;
  /** Whether it may not be changed. */
  protected?: boolean;
}

/** A directory's entries. */
export interface FileListing {
  /** The directory. */
  path: string;
  /** The directories first, then the files, alphabetically. */
  entries: FileEntry[];
}

/** A file's content. */
export interface FileContent {
  /** The file. */
  path: string;
  /** Its size in bytes. */
  size: number;
  /** Whether it is text. */
  is_text: boolean;
  /** The content, in `encoding`. */
  content: string;
  /** `utf8` or `base64`. */
  encoding: string;
}

/** A stored upload. */
export interface Upload {
  /** Where it was stored. */
  path: string;
  /** `[IMAGE:<path>]`, to put in a message. */
  marker: string;
}

/** The shared-directory and upload endpoints, from {@link Client.files}. */
export class FilesApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /api/browse`: a shared-area directory, its root without `path`. */
  async list(path?: string): Promise<FileListing> {
    return this.#c._json("GET", ["api", "browse"], { query: { path } });
  }

  /** `POST /api/browse/mkdir`: creates a directory. */
  async makeDir(path: string): Promise<void> {
    await this.#c._empty("POST", ["api", "browse", "mkdir"], { json: { path } });
  }

  /** `DELETE /api/browse/rmdir`: removes a directory and its contents. */
  async removeDir(path: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "browse", "rmdir"], { json: { path } });
  }

  /**
   * `POST /api/upload`: stores an image in `agent`'s workspace. PNG, JPEG,
   * GIF or WebP, told by its bytes. Returns the marker that attaches it to a
   * chat message.
   */
  async uploadImage(agent: string, image: Blob | ArrayBuffer | Uint8Array): Promise<Upload> {
    return this.#c._json("POST", ["api", "upload"], {
      query: { agent },
      body: image as BodyInit,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }
}
