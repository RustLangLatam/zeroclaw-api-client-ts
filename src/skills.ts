/**
 * Skill bundles and the skills in them.
 *
 * Gateway handler: `crates/zeroclaw-gateway/src/api_skills.rs`. Bundles
 * themselves are configuration (`skill_bundles.<alias>`); this module edits
 * the skills inside them. A skill is a SKILL.md: front matter plus a
 * Markdown body.
 *
 * @module
 */

import type { Client } from "./client.js";

/** A skill bundle. */
export interface SkillBundle {
  /** The bundle's alias. */
  alias: string;
  /** Its directory. */
  directory: string;
  /** The skills it includes. */
  include?: string[] | null;
  /** The skills it leaves out. */
  exclude?: string[] | null;
}

/** A skill in a listing. */
export interface SkillSummary {
  /** The bundle. */
  bundle: string;
  /** The skill's name. */
  name: string;
  /** Its directory. */
  directory: string;
  /** The front matter (name, description, tags, slash_options, …). */
  frontmatter: unknown;
}

/** A skill. */
export interface Skill {
  /** The bundle. */
  bundle: string;
  /** The skill's name. */
  name: string;
  /** The front matter. */
  frontmatter: unknown;
  /** The Markdown body. */
  body: string;
}

function skillPath(bundle: string, name: string): string[] {
  return ["api", "skills", "bundles", bundle, "skills", name];
}

/** The skill endpoints (`/api/skills`), from {@link Client.skills}. */
export class SkillsApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `GET /api/skills/bundles`: the skill bundles. */
  async bundles(): Promise<SkillBundle[]> {
    return this.#c._field("GET", ["api", "skills", "bundles"], "bundles");
  }

  /** `GET /api/skills/bundles/{bundle}/skills`: the skills of a bundle. */
  async list(bundle: string): Promise<SkillSummary[]> {
    return this.#c._field("GET", ["api", "skills", "bundles", bundle, "skills"], "skills");
  }

  /**
   * `POST /api/skills/bundles/{bundle}/skills`: creates a skill. It gets
   * scripts/, references/ and assets/ unless `noScaffold`.
   */
  async create(
    bundle: string,
    name: string,
    frontmatter: unknown,
    body: string,
    noScaffold = false,
  ): Promise<void> {
    await this.#c._empty("POST", ["api", "skills", "bundles", bundle, "skills"], {
      json: { name, frontmatter, body, no_scaffold: noScaffold },
    });
  }

  /** `GET /api/skills/bundles/{bundle}/skills/{name}`: a skill. */
  async read(bundle: string, name: string): Promise<Skill> {
    return this.#c._json("GET", skillPath(bundle, name));
  }

  /** `PUT /api/skills/bundles/{bundle}/skills/{name}`: replaces a skill's front matter and body. */
  async write(bundle: string, name: string, frontmatter: unknown, body: string): Promise<void> {
    await this.#c._empty("PUT", skillPath(bundle, name), { json: { frontmatter, body } });
  }

  /** `DELETE /api/skills/bundles/{bundle}/skills/{name}`: archives a skill, or deletes it for good with `purge`. */
  async delete(bundle: string, name: string, purge = false): Promise<void> {
    await this.#c._empty("DELETE", skillPath(bundle, name), { query: { purge } });
  }

  /** `GET /api/skills/slash-option-kinds`: the option types a skill's slash command may declare. */
  async slashOptionKinds(): Promise<unknown[]> {
    return this.#c._field("GET", ["api", "skills", "slash-option-kinds"], "kinds");
  }
}
