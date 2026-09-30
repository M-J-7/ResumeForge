/**
 * The usage counter's vocabulary: what a page may send, and how a view and a
 * source are reduced to a name before they leave the browser.
 *
 * The reductions are where privacy is decided — a view is a public path and
 * never an id or a query; a source is a name from a list and never the
 * referring page — so each is tested on the inputs that would leak if they
 * were done carelessly.
 */

import { describe, expect, it } from "vitest";
import {
  ACTION_DESCRIPTIONS,
  ACTION_EVENTS,
  isEventName,
  MAX_EVENT_NAME_LENGTH,
  METER_EVENTS,
  SOURCES,
  sourceOf,
  viewEvent,
} from "./events";

const ORIGIN = "https://sixseconds.tech";

describe("viewEvent", () => {
  it("names the public pages by their path", () => {
    for (const path of ["/", "/check", "/templates", "/examples", "/guides/resume-file-format"]) {
      expect(viewEvent(path)).toBe(`view:${path}`);
    }
    expect(viewEvent("/examples/cashier")).toBe("view:/examples/cashier");
    expect(viewEvent("/resume-keyword-scanner")).toBe("view:/resume-keyword-scanner");
  });

  it("names an application page by its section, never by the id in it", () => {
    expect(viewEvent("/letters/clxyz123abc")).toBe("view:/letters");
    expect(viewEvent("/builder")).toBe("view:/builder");
    expect(viewEvent("/dashboard")).toBe("view:/dashboard");
  });

  it("ignores a trailing slash and counts nothing it does not recognise", () => {
    expect(viewEvent("/pricing/")).toBe("view:/pricing");
    expect(viewEvent("/signin/check-email")).toBeNull();
    expect(viewEvent("/api/health")).toBeNull();
    expect(viewEvent("/examples/UPPER")).toBeNull();
    expect(viewEvent("/examples/a/b")).toBeNull();
    expect(viewEvent("/wp-login.php")).toBeNull();
  });
});

describe("sourceOf", () => {
  it("calls a visit with no referrer direct, and a click inside the site nothing", () => {
    expect(sourceOf("", ORIGIN)).toBe("direct");
    expect(sourceOf(`${ORIGIN}/examples`, ORIGIN)).toBeNull();
  });

  it("names the engines and sites a visit comes from, whatever their country domain", () => {
    expect(sourceOf("https://www.google.com/", ORIGIN)).toBe("google");
    expect(sourceOf("https://www.google.co.in/", ORIGIN)).toBe("google");
    expect(sourceOf("android-app://com.google.android.googlequicksearchbox/", ORIGIN)).toBe(
      "google",
    );
    expect(sourceOf("https://gemini.google.com/app", ORIGIN)).toBe("gemini");
    expect(sourceOf("https://www.bing.com/", ORIGIN)).toBe("bing");
    expect(sourceOf("https://chatgpt.com/", ORIGIN)).toBe("chatgpt");
    expect(sourceOf("https://old.reddit.com/r/resumes/comments/abc", ORIGIN)).toBe("reddit");
    expect(sourceOf("https://news.ycombinator.com/item?id=1", ORIGIN)).toBe("hackernews");
    expect(sourceOf("https://t.co/xyz", ORIGIN)).toBe("x");
    expect(sourceOf("https://l.facebook.com/l.php?u=x", ORIGIN)).toBe("facebook");
    expect(sourceOf("https://lnkd.in/abc", ORIGIN)).toBe("linkedin");
  });

  it("does not let a look-alike host pass for a real one", () => {
    expect(sourceOf("https://notreddit.com/", ORIGIN)).toBe("other");
    expect(sourceOf("https://reddit.com.evil.example/", ORIGIN)).toBe("other");
    expect(sourceOf("https://google.evil.example/", ORIGIN)).toBe("other");
  });

  it("keeps nothing of the referring page but the name it maps to", () => {
    // The search terms some engines still carry are exactly what must not
    // survive; the return value is a name from a fixed list and nothing else.
    const source = sourceOf("https://www.google.com/search?q=my+name+resume", ORIGIN);
    expect(source).toBe("google");
    expect(SOURCES).toContain(source);
    expect(sourceOf("not a url", ORIGIN)).toBe("other");
  });
});

describe("isEventName", () => {
  it("accepts the actions, the sources and the page views", () => {
    for (const name of ACTION_EVENTS) expect(isEventName(name), name).toBe(true);
    for (const source of SOURCES) expect(isEventName(`src:${source}`), source).toBe(true);
    expect(isEventName("view:/check")).toBe(true);
    expect(isEventName("view:/letters")).toBe(true);
  });

  it("refuses anything else, including the names only the server may write", () => {
    for (const name of METER_EVENTS) expect(isEventName(name), name).toBe(false);
    expect(isEventName("export:png")).toBe(false);
    expect(isEventName("src:myspace")).toBe(false);
    expect(isEventName("view:/letters/abc")).toBe(false);
    expect(isEventName("view:/check?email=someone@example.com")).toBe(false);
    expect(isEventName("")).toBe(false);
    expect(isEventName(`view:/examples/${"a".repeat(MAX_EVENT_NAME_LENGTH)}`)).toBe(false);
  });
});

describe("the privacy page's list", () => {
  it("describes exactly the actions there are", () => {
    expect(Object.keys(ACTION_DESCRIPTIONS).sort()).toEqual([...ACTION_EVENTS].sort());
    for (const description of Object.values(ACTION_DESCRIPTIONS)) {
      expect(description.length).toBeGreaterThan(10);
    }
  });
});
