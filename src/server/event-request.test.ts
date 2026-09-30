/**
 * What `POST /api/e` will and will not count — each rule in
 * `event-request.ts`, shown refusing the request it exists to refuse.
 */

import { describe, expect, it } from "vitest";
import { judgeEventRequest, MAX_BODY_BYTES } from "./event-request";

const ORIGIN = "https://sixseconds.tech";
const BROWSER =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/e`, {
    method: "POST",
    body,
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "user-agent": BROWSER,
      ...headers,
    },
  });
}

const judge = (request: Request) => judgeEventRequest(request, ORIGIN);

describe("judgeEventRequest", () => {
  it("counts an allowlisted name sent the way the page sends it", async () => {
    expect(await judge(post('{"e":"export:pdf"}'))).toEqual({ status: 204, count: "export:pdf" });
    expect(await judge(post('{"e":"view:/examples/cashier"}'))).toEqual({
      status: 204,
      count: "view:/examples/cashier",
    });
    expect(await judge(post('{"e":"src:reddit"}'))).toEqual({ status: 204, count: "src:reddit" });
  });

  it("refuses another origin, and a request that names none", async () => {
    expect(
      await judge(post('{"e":"export:pdf"}', { origin: "https://elsewhere.example" })),
    ).toEqual({ status: 403 });
    const anonymous = new Request(`${ORIGIN}/api/e`, {
      method: "POST",
      body: '{"e":"export:pdf"}',
      headers: { "content-type": "application/json" },
    });
    expect(await judge(anonymous)).toEqual({ status: 403 });
  });

  it("refuses an event that arrives with a cookie, so none is ever beside a session", async () => {
    expect(await judge(post('{"e":"export:pdf"}', { cookie: "authjs.session-token=abc" }))).toEqual(
      { status: 400 },
    );
  });

  it("refuses anything but JSON — the type no cross-site form or beacon can send", async () => {
    expect(await judge(post('{"e":"export:pdf"}', { "content-type": "text/plain" }))).toEqual({
      status: 415,
    });
  });

  it("refuses a body too large to be one name, before reading it where it can", async () => {
    const big = JSON.stringify({ e: "x".repeat(MAX_BODY_BYTES) });
    expect(await judge(post(big))).toEqual({ status: 413 });
    expect(await judge(post(big, { "content-length": String(big.length) }))).toEqual({
      status: 413,
    });
  });

  it("refuses a malformed body, and a second key where a property would ride along", async () => {
    for (const body of [
      "not json",
      "[]",
      "null",
      '"export:pdf"',
      '{"e":"export:pdf","resume":"Ada Lovelace"}',
      '{"e":42}',
      "{}",
    ]) {
      expect(await judge(post(body)), body).toEqual({ status: 400 });
    }
  });

  it("refuses names that are not on the list, and the ones only the server writes", async () => {
    for (const name of [
      "export:png",
      "meter:dropped",
      "view:/nope",
      "view:/letters/abc",
      "src:x.com",
    ]) {
      expect(await judge(post(JSON.stringify({ e: name }))), name).toEqual({ status: 400 });
    }
  });

  it("answers a crawler normally and does not count it", async () => {
    for (const agent of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Chrome-Lighthouse",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0 Safari/537.36",
      "curl/8.9.1",
    ]) {
      expect(await judge(post('{"e":"view:/"}', { "user-agent": agent })), agent).toEqual({
        status: 204,
      });
    }
  });
});
