// The client itself: URLs, tokens, errors, retries and timeouts.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiError,
  Client,
  InvalidUrlError,
  isNotFound,
  isRateLimited,
  isTransient,
  isUnauthorized,
  RequestTimeoutError,
  statusCode,
  TransportError,
} from "../src/index.js";
import { gateway, json, TOKEN } from "./helpers.js";

test("the base URL must be absolute http or https", () => {
  for (const bad of ["127.0.0.1:42617", "ftp://gw", "/api", ""]) {
    assert.throws(() => new Client(bad), InvalidUrlError, bad);
  }
  assert.equal(new Client("https://gw.test/zc/").baseUrl, "https://gw.test/zc");
});

test("path segments are escaped one by one under the base path", async () => {
  const requests: string[] = [];
  const client = new Client("http://gw.test/prefix/", {
    fetch: (async (url: string) => {
      requests.push(url);
      return json({ deleted: true });
    }) as typeof fetch,
  });
  await client.memory.forget("a/b?c d@e:+");
  assert.equal(requests[0], "http://gw.test/prefix/api/memory/a%2Fb%3Fc%20d@e:+");
});

test("unset, null and empty query values are not sent", () => {
  const client = new Client("http://gw.test");
  assert.equal(
    client._url(["x"], { a: undefined, b: null, c: "", d: 0, e: false, f: "a b" }),
    "http://gw.test/x?d=0&e=false&f=a+b",
  );
});

test("the token is sent but never shown", async () => {
  const { client, requests } = gateway(() => json({ status: "ok" }));
  await client.system.health();
  assert.equal(requests[0]?.headers.get("authorization"), `Bearer ${TOKEN}`);
  assert.ok(!String(client).includes(TOKEN));
  assert.ok(!JSON.stringify(client).includes(TOKEN));
  assert.equal(client.authenticated, true);
});

test("withToken keeps the gateway and swaps the token", async () => {
  const { client, requests } = gateway(() => json({ status: "ok" }));
  await client.withToken("zc_other").system.health();
  await client.withToken(undefined).system.health();
  assert.equal(requests[0]?.headers.get("authorization"), "Bearer zc_other");
  assert.equal(requests[1]?.headers.get("authorization"), null);
});

test("a refusal keeps the status, the gateway's reason and its body", async () => {
  const { client } = gateway(() => json({ error: "unknown agent", code: "x" }, 404));
  const err = await client.system.status("nope").catch((e: unknown) => e);
  assert.ok(err instanceof ApiError);
  assert.equal(err.status, 404);
  assert.equal(err.reason, "unknown agent");
  assert.deepEqual(err.body, { error: "unknown agent", code: "x" });
  assert.equal(err.message, "gateway answered 404: unknown agent");
  assert.ok(isNotFound(err));
  assert.equal(statusCode(err), 404);
});

test("ApiError.fromResponse reads error, message or the text", () => {
  const cases: Array<[string, string, unknown]> = [
    ['{"error":"bad"}', "bad", { error: "bad" }],
    ['{"message":"worse"}', "worse", { message: "worse" }],
    ['{"error":{"k":1}}', '{"k":1}', { error: { k: 1 } }],
    ["plain text \n", "plain text", undefined],
    ["[1]", "[1]", [1]],
  ];
  for (const [text, reason, body] of cases) {
    const err = ApiError.fromResponse(500, text);
    assert.equal(err.reason, reason, text);
    assert.deepEqual(err.body, body, text);
  }
});

test("errors are classified", () => {
  const api = (status: number) => new ApiError(status, "x");
  assert.ok(isUnauthorized(api(401)) && isUnauthorized(api(403)));
  assert.ok(isRateLimited(api(429)));
  for (const status of [408, 429, 502, 503, 504]) assert.ok(isTransient(api(status)), `${status}`);
  assert.ok(!isTransient(api(500)) && !isTransient(api(404)));
  assert.ok(isTransient(new TransportError("down")));
  assert.ok(isTransient(new RequestTimeoutError()));
  assert.ok(!isTransient(new Error("other")));
  assert.equal(statusCode(new Error("x")), 0);
});

test("idempotent calls are retried on a transient answer", async () => {
  let calls = 0;
  const { client } = gateway(() =>
    ++calls < 3 ? json({ error: "busy" }, 503) : json({ status: "ok" }),
  );
  assert.deepEqual(await client.system.health(), { status: "ok" });
  assert.equal(calls, 3);
});

test("retries give up after maxRetries", async () => {
  let calls = 0;
  const { client } = gateway(
    () => {
      calls++;
      return json({ error: "busy" }, 502);
    },
    { retry: { maxRetries: 2, baseDelay: 0 } },
  );
  await assert.rejects(client.system.health(), { name: "ApiError", status: 502 });
  assert.equal(calls, 3);
});

test("a POST is never retried", async () => {
  let calls = 0;
  const { client } = gateway(() => {
    calls++;
    return json({ error: "busy" }, 503);
  });
  await assert.rejects(client.system.doctor(), { status: 503 });
  assert.equal(calls, 1);
});

test("a 500 is not retried", async () => {
  let calls = 0;
  const { client } = gateway(() => {
    calls++;
    return json({ error: "boom" }, 500);
  });
  await assert.rejects(client.system.health(), { status: 500 });
  assert.equal(calls, 1);
});

test("connection failures are retried, then reported as TransportError", async () => {
  let calls = 0;
  const { client } = gateway(() => {
    calls++;
    throw new TypeError("fetch failed");
  });
  const err = await client.system.health().catch((e: unknown) => e);
  assert.ok(err instanceof TransportError);
  assert.match(err.message, /fetch failed/);
  assert.ok(err.cause instanceof TypeError);
  assert.equal(calls, 4);
});

test("retry: false turns retries off", async () => {
  let calls = 0;
  const { client } = gateway(
    () => {
      calls++;
      return json({}, 503);
    },
    { retry: false },
  );
  await assert.rejects(client.system.health());
  assert.equal(calls, 1);
});

test("Retry-After is honored up to maxDelay", async () => {
  let calls = 0;
  const started = Date.now();
  const { client } = gateway(
    () => (++calls === 1 ? json({}, 429, { "Retry-After": "1" }) : json({ status: "ok" })),
    { retry: { baseDelay: 0, maxDelay: 50 } },
  );
  await client.system.health();
  const waited = Date.now() - started;
  assert.ok(waited >= 40 && waited < 900, `waited ${waited} ms`);
});

test("the timeout bounds the wait for the answer", async () => {
  const { client } = gateway(
    (seen) =>
      new Promise<Response>(() => {
        // Never answers; the request's signal is what ends it.
        void seen;
      }),
    { timeout: 20, retry: false },
  );
  await assert.rejects(client.system.health(), RequestTimeoutError);
});

test("the timeout aborts the request's signal", async () => {
  let aborted = false;
  const client = new Client("http://gw.test", {
    timeout: 10,
    retry: false,
    fetch: ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as typeof fetch,
  });
  await assert.rejects(client.system.health(), RequestTimeoutError);
  assert.ok(aborted);
});

test("a long call uses its own timeout", async () => {
  const { client } = gateway(
    () => new Promise((resolve) => setTimeout(() => resolve(json({ success: true })), 40)),
    { timeout: 10 },
  );
  assert.deepEqual(await client.cron.run("j"), { success: true });
});

test("a body that is not JSON is a DecodeError", async () => {
  const { client } = gateway(() => new Response("<html>"));
  await assert.rejects(client.system.status(), { name: "DecodeError" });
});

test("an empty answer decodes as null", async () => {
  const { client } = gateway(() => new Response(""));
  assert.equal(await client.system.openapi(), null);
});
