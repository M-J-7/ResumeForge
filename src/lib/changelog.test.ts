/**
 * The changelog is dated honestly, in order, and describes rather than sells.
 *
 * Its dates go to every crawler through the sitemap, the same way the
 * examples' and guides' do, and a crawler that catches a site's dates being
 * wrong stops using them (`content-dates.test.ts`). And it is a page on this
 * site like any other, so D14 holds on it too.
 */

import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { forbiddenClaimIn } from "@/test/claims";
import { CHANGELOG, CHANGELOG_UPDATED, changelogByDay } from "./changelog";

describe("CHANGELOG", () => {
  it("is dated, newest first, and never ahead of the day it was written for", () => {
    const dates = CHANGELOG.map((entry) => entry.date);
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(CHANGELOG_UPDATED).toBe(dates[0]);
    // The launch is the floor: nothing reached a site that did not exist.
    expect(dates.at(-1)).toBe("2026-09-12");
  });

  it("gives every change a title, a sentence or more, and unique titles", () => {
    const titles = CHANGELOG.map((entry) => entry.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const entry of CHANGELOG) {
      expect(entry.title.length, entry.title).toBeGreaterThan(8);
      expect(entry.body.length, entry.title).toBeGreaterThan(60);
      if (entry.link) expect(entry.link.href, entry.title).toMatch(/^\//);
    }
  });

  it("claims no outcome (D14)", () => {
    const text = CHANGELOG.map((entry) => `${entry.title}. ${entry.body}`).join("\n");
    expect(forbiddenClaimIn(text)).toBeNull();
    // The check is live, not a filter that passes everything.
    expect(forbiddenClaimIn("Every template is guaranteed to pass the ATS.")).not.toBeNull();
  });

  it("groups by day without reordering anything", () => {
    const days = changelogByDay();
    expect(days.flatMap((day) => day.entries)).toEqual([...CHANGELOG]);
    expect(new Set(days.map((day) => day.date)).size).toBe(days.length);
  });

  it("is in the sitemap, dated by its newest entry", () => {
    const entry = sitemap().find((item) => new URL(item.url).pathname === "/changelog");
    expect(entry?.lastModified).toBe(CHANGELOG_UPDATED);
  });
});
