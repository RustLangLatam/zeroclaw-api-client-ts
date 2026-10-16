/**
 * Hardware-key (WebAuthn) registration and assertion, an extra check on top
 * of the bearer token.
 *
 * Gateway handler: `crates/zeroclaw-gateway/src/api_webauthn.rs` (built
 * with the `webauthn` feature; 404 when it is off). The ceremony itself runs
 * in the authenticator (`navigator.credentials` in a browser): this API only
 * carries its JSON, with ZeroClaw's snake_case field names and base64url
 * binary fields.
 *
 * @module
 */

import type { Client } from "./client.js";

/** The WebAuthn endpoints (`/api/webauthn`), from {@link Client.webauthn}. */
export class WebAuthnApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /** `POST /api/webauthn/register/start`: the creation challenge for a new key of `userId`. */
  async registerStart(userId: string, userName: string): Promise<unknown> {
    return this.#c._json("POST", ["api", "webauthn", "register", "start"], {
      json: { user_id: userId, user_name: userName },
    });
  }

  /**
   * `POST /api/webauthn/register/finish`: sends the authenticator's answer
   * and returns the registered key. `credential` holds `challenge`, `id`,
   * `attestation_object`, `client_data_json` and an optional `label`; the
   * answer is `{credential_id, label, registered_at}`.
   */
  async registerFinish(credential: unknown): Promise<unknown> {
    return this.#c._json("POST", ["api", "webauthn", "register", "finish"], { json: credential });
  }

  /** `POST /api/webauthn/auth/start`: the assertion challenge for `userId`. */
  async authStart(userId: string): Promise<unknown> {
    return this.#c._json("POST", ["api", "webauthn", "auth", "start"], {
      json: { user_id: userId },
    });
  }

  /**
   * `POST /api/webauthn/auth/finish`: sends the authenticator's assertion.
   * `assertion` holds `challenge`, `id`, `authenticator_data`,
   * `client_data_json` and `signature`. Refused with 401 when it does not
   * verify.
   */
  async authFinish(assertion: unknown): Promise<unknown> {
    return this.#c._json("POST", ["api", "webauthn", "auth", "finish"], { json: assertion });
  }

  /** `GET /api/webauthn/credentials`: the keys of `userId`. */
  async credentials(userId: string): Promise<unknown> {
    return this.#c._json("GET", ["api", "webauthn", "credentials"], { query: { user_id: userId } });
  }

  /** `DELETE /api/webauthn/credentials/{id}`: removes key `credentialId` of `userId`. */
  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "webauthn", "credentials", credentialId], {
      query: { user_id: userId },
    });
  }
}
