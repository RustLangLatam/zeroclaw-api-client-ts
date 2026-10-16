/**
 * The errors the client throws, and helpers to classify them.
 *
 * Every error is a {@link ZeroClawError}. A gateway answer with a non-success
 * status is an {@link ApiError} carrying the status, the gateway's message and
 * its JSON body.
 *
 * @module
 */

/** Statuses that ask the client to try again later. */
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 502, 503, 504]);

/** Base class of every error the client throws. */
export class ZeroClawError extends Error {
  override name = "ZeroClawError";
}

/** The gateway URL, or a URL built from it, is not valid. */
export class InvalidUrlError extends ZeroClawError {
  override name = "InvalidUrlError";
}

/**
 * The request never got an HTTP answer: connection refused, DNS or TLS
 * failure, a connection dropped before the answer, or a CORS refusal in a
 * browser. The underlying error is the `cause`.
 */
export class TransportError extends ZeroClawError {
  override name = "TransportError";
}

/** The gateway did not answer within the client's timeout (after any retries). */
export class RequestTimeoutError extends ZeroClawError {
  override name = "RequestTimeoutError";
  constructor(message = "the gateway did not answer in time") {
    super(message);
  }
}

/** The gateway answered successfully but the body did not have the expected shape. */
export class DecodeError extends ZeroClawError {
  override name = "DecodeError";
}

/** A WebSocket connection to the gateway failed. */
export class WebSocketError extends ZeroClawError {
  override name = "WebSocketError";
}

/**
 * A gateway answer with a non-success status. Its `message` reads
 * `gateway answered <status>: <reason>`.
 */
export class ApiError extends ZeroClawError {
  override name = "ApiError";
  /** The HTTP status code. */
  readonly status: number;
  /**
   * The gateway's own explanation (its `error` or `message` field) when the
   * body carries one, otherwise the body text.
   */
  readonly reason: string;
  /** The JSON error body, when the gateway sent one. */
  readonly body: unknown;

  constructor(status: number, reason: string, body?: unknown) {
    super(`gateway answered ${status}: ${reason}`);
    this.status = status;
    this.reason = reason;
    this.body = body;
  }

  /** Builds the error from a failed answer's status and body text. */
  static fromResponse(status: number, text: string): ApiError {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return new ApiError(status, text.trim());
    }
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      for (const key of ["error", "message"]) {
        if (key in body) {
          const value = (body as Record<string, unknown>)[key];
          return new ApiError(
            status,
            typeof value === "string" ? value : JSON.stringify(value),
            body,
          );
        }
      }
    }
    return new ApiError(status, text.trim(), body);
  }
}

/** An agent turn on the chat that ended in an `error` frame, or was aborted. */
export class TurnError extends ZeroClawError {
  override name = "TurnError";
  /** The stable code, e.g. `PROVIDER_ERROR` or `ABORTED`; empty when the gateway sent none. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(`agent turn failed: ${message}`);
    this.code = code;
  }
}

/** The HTTP status of an {@link ApiError}, or 0 for any other error. */
export function statusCode(err: unknown): number {
  return err instanceof ApiError ? err.status : 0;
}

/** Whether the gateway answered 404 (the resource does not exist). */
export function isNotFound(err: unknown): boolean {
  return statusCode(err) === 404;
}

/** Whether the gateway refused the credentials (401) or the action (403). */
export function isUnauthorized(err: unknown): boolean {
  const status = statusCode(err);
  return status === 401 || status === 403;
}

/** Whether the gateway rate-limited the call (429). */
export function isRateLimited(err: unknown): boolean {
  return statusCode(err) === 429;
}

/**
 * Whether the call may work if made again later: no connection, a
 * connection dropped before the answer, a timeout, or a "try again" status
 * (408, 429, 502, 503, 504). The client already retried idempotent calls
 * before throwing it.
 */
export function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) return RETRYABLE_STATUSES.has(err.status);
  return err instanceof TransportError || err instanceof RequestTimeoutError;
}
