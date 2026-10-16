/**
 * Pairing (how a client gets its bearer token) and the paired devices.
 *
 * Gateway handlers: `crates/zeroclaw-gateway/src/lib.rs` (`/pair`,
 * `/pair/code`, `/admin/paircode*`) and `api_pairing.rs`. A pairing code is
 * six digits, single use, valid ten minutes; the token it buys is `zc_` + 64
 * hex characters. Exchange a code for a token with {@link PairingApi.pair},
 * then get a client that uses it with {@link Client.withToken}.
 *
 * @module
 */

import type { Client } from "./client.js";

/** A successful pairing. */
export interface Paired {
  /** Always true. */
  paired: boolean;
  /** Whether the token was saved in the gateway's configuration. */
  persisted?: boolean;
  /** The bearer token. Keep it secret. */
  token: string;
  /** The gateway's note. */
  message?: string | null;
}

/** A pairing code and whether pairing is required. */
export interface PairingCode {
  /** Whether the request succeeded. */
  success?: boolean;
  /** Whether the gateway requires pairing. */
  pairing_required: boolean;
  /** The six-digit code, when one is pending and may be shown. */
  pairing_code?: string | null;
  /** The gateway's note. */
  message?: string | null;
}

/** A paired device. */
export interface Device {
  /** The device id. */
  id: string;
  /** The name given at pairing. */
  name?: string | null;
  /** The type given at pairing (`legacy` for tokens older than the registry). */
  device_type?: string | null;
  /** When it paired (RFC 3339). */
  paired_at: string;
  /** When it was last seen (RFC 3339). */
  last_seen: string;
  /** The address it paired from. */
  ip_address?: string | null;
  /** The advertised capabilities. */
  capabilities?: string[] | null;
}

/** The pairing and paired devices endpoints, from {@link Client.pairing}. */
export class PairingApi {
  readonly #c: Client;

  /** @internal */
  constructor(client: Client) {
    this.#c = client;
  }

  /**
   * `POST /api/pair`: exchanges a pairing code for a bearer token,
   * registering this client as a device. Public.
   */
  async pair(code: string, deviceName?: string, deviceType?: string): Promise<Paired> {
    return this.#c._json("POST", ["api", "pair"], {
      json: { code, device_name: deviceName || null, device_type: deviceType || null },
    });
  }

  /** `POST /pair`: pairs the original way, with the code in the `X-Pairing-Code` header. Public. */
  async pairLegacy(code: string): Promise<Paired> {
    return this.#c._json("POST", ["pair"], { headers: { "X-Pairing-Code": code } });
  }

  /** `GET /pair/code`: the first-run pairing code, shown only while no client is paired yet. Public. */
  async initialCode(): Promise<PairingCode> {
    return this.#c._json("GET", ["pair", "code"]);
  }

  /** `POST /api/pairing/initiate`: mints a new pairing code (replacing a pending one) so another device can pair. */
  async newCode(): Promise<string> {
    return this.#c._field("POST", ["api", "pairing", "initiate"], "pairing_code");
  }

  /** `GET /admin/paircode`: the pending pairing code. Loopback only. */
  async adminCode(): Promise<PairingCode> {
    return this.#c._json("GET", ["admin", "paircode"]);
  }

  /**
   * `POST /admin/paircode/new`: mints a pairing code. Loopback only.
   * `rotate` revokes first: `all` every token and device, otherwise the
   * device with that id.
   */
  async adminNewCode(rotate?: string): Promise<PairingCode> {
    return this.#c._json("POST", ["admin", "paircode", "new"], { query: { rotate } });
  }

  /** `GET /api/devices`: the paired devices. */
  async devices(): Promise<Device[]> {
    return this.#c._field("GET", ["api", "devices"], "devices");
  }

  /** `DELETE /api/devices/{id}`: revokes a device and its token; it may be this client's own. */
  async revokeDevice(id: string): Promise<void> {
    await this.#c._empty("DELETE", ["api", "devices", id]);
  }

  /**
   * `POST /api/devices/{id}/token/rotate`: revokes a device's token and
   * mints a pairing code for it to pair again. The code is `null` when one
   * was already pending or pairing is off.
   */
  async rotateDeviceToken(id: string): Promise<string | null> {
    const envelope = await this.#c._json<unknown>("POST", [
      "api",
      "devices",
      id,
      "token",
      "rotate",
    ]);
    const code =
      envelope !== null && typeof envelope === "object"
        ? (envelope as Record<string, unknown>).pairing_code
        : undefined;
    return typeof code === "string" ? code : null;
  }

  /** `POST /api/devices/me/capabilities`: replaces the capabilities this client's device advertises and returns them. */
  async setCapabilities(capabilities: readonly string[]): Promise<string[]> {
    return this.#c._field("POST", ["api", "devices", "me", "capabilities"], "capabilities", {
      json: { capabilities },
    });
  }
}
