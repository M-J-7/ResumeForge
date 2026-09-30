/**
 * The server's list of countable pages and the browser's shapes agree, and
 * the list covers the sitemap.
 *
 * Two lists of one thing drift. If the server lacked a page the sitemap has,
 * its views would be refused without a sound; if the browser's shapes missed
 * one, they would never be sent. Both directions are checked against the
 * sitemap, which is generated from the same arrays the routes are.
 */

import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { viewEvent } from "@/lib/events";
import { COUNTED_PATHS, isCountedView } from "./event-paths";

describe("COUNTED_PATHS", () => {
  it("includes every page in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths.length).toBeGreaterThan(30);
    for (const path of paths) expect(COUNTED_PATHS.has(path), path).toBe(true);
  });

  it("is only paths the browser would send", () => {
    for (const path of COUNTED_PATHS) expect(viewEvent(path), path).toBe(`view:${path}`);
  });

  it("refuses a view of a page that does not exist", () => {
    expect(isCountedView("view:/examples/cashier")).toBe(true);
    expect(isCountedView("view:/examples/not-a-real-role")).toBe(false);
    expect(isCountedView("src:google")).toBe(false);
  });
});
