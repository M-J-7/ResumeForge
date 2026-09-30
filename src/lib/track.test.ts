// @vitest-environment jsdom
/**
 * What a counted event carries when it leaves the browser — fixed in one
 * function, so it is tested there: the name and nothing else, no cookie, and
 * nothing at all for a visitor whose browser has said no.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { declinedCounting, EVENTS_ENDPOINT, track } from "./track";

const send = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

beforeEach(() => {
  send.mockClear();
  vi.stubGlobal("fetch", send);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  Object.defineProperty(navigator, "globalPrivacyControl", { value: undefined, configurable: true });
});

describe("track", () => {
  it("posts the name, alone, to this site, without a cookie", () => {
    track("export:pdf");
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(EVENTS_ENDPOINT);
    expect(url.startsWith("/")).toBe(true);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ e: "export:pdf" });
  });

  it("sends nothing when the browser sends Global Privacy Control", () => {
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true });
    expect(declinedCounting()).toBe(true);
    track("view:/");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing when the browser sends Do Not Track", () => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    expect(declinedCounting()).toBe(true);
    track("view:/");
    expect(send).not.toHaveBeenCalled();
  });

  it("never throws into the page that called it", () => {
    vi.stubGlobal("fetch", () => {
      throw new TypeError("Failed to fetch");
    });
    expect(() => track("export:txt")).not.toThrow();
  });
});
