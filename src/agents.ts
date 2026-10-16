/**
 * Per-agent resources: the agent's workspace files, personality files and
 * skills. Agents themselves are configuration entries (`agents.<alias>`),
 * created and removed through the configuration endpoints.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/api_browse.rs`,
 * `api_personality.rs` and `api_skills.rs`. Workspace paths are relative to
 * the agent's workspace; escaping it is refused, and the personality files
 * and sessions at its root are protected.
 *
 * @module
 */

import type { Client } from "./client.js";
import type { FileContent, FileListing } from "./files.js";

/** Fills the default personality files of {@link AgentApi.personalityTemplates}; unset fields are not sent. */
export interface PersonalityContext {
  /** The agent's name. */
  agent_name?: string;
  /** The user's name. */
  user_name?: string;
  /** The time zone. */
  timezone?: string;
  /** The communication style. */
  communication_style?: string;
  /** Whether to render MEMORY.md. */
  include_memory?: boolean;
}

/** A personality file's presence. */
export interface PersonalityFileEntry {
  /** The file name. */
  filename: string;
  /** Whether it exists. */
  exists: boolean;
  /** Its size in bytes. */
  size: number;
  /** Its modification time, ms since the epoch. */
  mtime_ms?: number | null;
}

/** The personality files of an agent. */
export interface PersonalityFiles {
  /** Each editable file. */
  files: PersonalityFileEntry[];
  /** The maximum characters per file. */
  max_chars: number;
}

/** A personality file's content. */
export interface PersonalityFile {
  /** The file name. */
  filename: string;
  /** The content (`null` when the file does not exist). */
  content?: string | null;
  /** Whether it exists. */
  exists: boolean;
  /** Whether the content was cut at the size limit. */
  truncated: boolean;
  /** Its modification time, for {@link AgentApi.writePersonality}. */
  mtime_ms?: number | null;
}

/** The result of {@link AgentApi.writePersonality}. */
export interface PersonalityWritten {
  /** The number of bytes written. */
  bytes_written: number;
  /** The new modification time. */
  mtime_ms?: number | null;
}

/** The rendered default personality files. */
export interface PersonalityTemplates {
  /** The preset used. */
  preset: string;
  /** Each file: `{filename, content}`. */
  files: Array<{ filename: string; content: string }>;
}

/** The skills an agent loads. */
export interface AgentSkills {
  /** The agent. */
  agent: string;
  /** The loaded skills: name, description, origin (workspace, open-skills, plugin, bundle), editable, … */
  skills: unknown[];
  /** The skills left out, with `reason_kind` and `reason`. */
  dropped?: unknown[] | null;
}

/** One agent's endpoints, from {@link Client.agent}. */
export class AgentApi {
  readonly #c: Client;
  /** The agent's alias. */
  readonly alias: string;

  /** @internal */
  constructor(client: Client, alias: string) {
    this.#c = client;
    this.alias = alias;
  }

  #workspace(action: string): string[] {
    return ["api", "agents", this.alias, "workspace", action];
  }

  /** `GET /api/agents/{alias}/workspace/list`: a workspace directory, the root without `path`. */
  async listFiles(path?: string): Promise<FileListing> {
    return this.#c._json("GET", this.#workspace("list"), { query: { path } });
  }

  /**
   * `GET /api/agents/{alias}/workspace/read`: a workspace file, up to 4 MiB;
   * binary files come base64-encoded.
   */
  async readFile(path: string): Promise<FileContent> {
    return this.#c._json("GET", this.#workspace("read"), { query: { path } });
  }

  /** `POST /api/agents/{alias}/workspace/mkdir`: creates a directory. */
  async makeDir(path: string): Promise<void> {
    await this.#c._empty("POST", this.#workspace("mkdir"), { json: { path } });
  }

  /** `POST /api/agents/{alias}/workspace/move`: moves or renames a file or directory. */
  async movePath(from: string, to: string): Promise<void> {
    await this.#c._empty("POST", this.#workspace("move"), { json: { from, to } });
  }

  /** `DELETE /api/agents/{alias}/workspace/path`: removes a file or directory. */
  async removePath(path: string): Promise<void> {
    await this.#c._empty("DELETE", this.#workspace("path"), { json: { path } });
  }

  /** `GET /api/personality`: the agent's personality files and whether each exists. */
  async personalityFiles(): Promise<PersonalityFiles> {
    return this.#c._json("GET", ["api", "personality"], { query: { agent: this.alias } });
  }

  /**
   * `GET /api/personality/{filename}`: one personality file. `filename` is
   * SOUL.md, IDENTITY.md, USER.md, AGENTS.md, TOOLS.md, HEARTBEAT.md or
   * MEMORY.md.
   */
  async personality(filename: string): Promise<PersonalityFile> {
    return this.#c._json("GET", ["api", "personality", filename], { query: { agent: this.alias } });
  }

  /**
   * `PUT /api/personality/{filename}`: replaces a personality file, at most
   * 20 000 characters. With `expectedMtimeMs`, the write is refused (409) if
   * the file changed since it was read.
   */
  async writePersonality(
    filename: string,
    content: string,
    expectedMtimeMs?: number,
  ): Promise<PersonalityWritten> {
    return this.#c._json("PUT", ["api", "personality", filename], {
      query: { agent: this.alias },
      json: { content, expected_mtime_ms: expectedMtimeMs ?? null },
    });
  }

  /** `GET /api/personality/templates`: the default personality files rendered for this agent, without writing them. */
  async personalityTemplates(context: PersonalityContext = {}): Promise<PersonalityTemplates> {
    return this.#c._json("GET", ["api", "personality", "templates"], {
      query: { agent: this.alias, ...context },
    });
  }

  /**
   * `GET /api/agents/{alias}/skills`: the skills the agent loads, where each
   * comes from, and those the audit dropped.
   */
  async skills(): Promise<AgentSkills> {
    return this.#c._json("GET", ["api", "agents", this.alias, "skills"]);
  }
}
