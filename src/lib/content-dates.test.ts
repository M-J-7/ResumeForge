/**
 * The "Updated" dates on the content pages, held to the content.
 *
 * A date on a page is a claim. The sitemap sends it to every crawler as
 * `lastmod`, the Article markup as `dateModified`, and the page shows it to
 * the reader — and a date that says September while the page changed in
 * November is false in all three places at once, with nothing on screen to
 * show it. Google's documented response to a site whose `lastmod` values turn
 * out to be unreliable is to stop reading them.
 *
 * So each page's content is hashed, and the hash is pinned here beside the
 * date it was true on. Change an example or a guide and this fails, naming
 * the page: set its `updated` to the day of the change, then paste the new
 * hash the failure prints. Changing the date without the content is caught
 * too, because the date is part of the pin.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GUIDES } from "./guides/guides";
import { ROLE_EXAMPLES } from "./examples/roles";
import { formatContentDate, isContentDate, latestUpdate } from "./content-dates";
import { ACTION_VERBS_UPDATED, VERB_GROUPS, WEAK_OPENERS } from "./verbs/action-verbs";

/** A short, stable fingerprint of everything on the page but the date. */
function contentHash(entry: { updated: string }): string {
  // `undefined` rather than a destructure-and-discard: `JSON.stringify` drops
  // the key, so the hash covers everything except the date.
  const content = { ...entry, updated: undefined };
  return createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 12);
}

/** `slug` → `updated@hash`, true when written. */
const PINNED: Readonly<Record<string, string>> = {
  cashier: "2026-09-29@009c19066838",
  "medical-assistant": "2026-09-29@7dc4d23ae958",
  "warehouse-associate": "2026-09-29@d4270f4e611d",
  "certified-nursing-assistant": "2026-09-29@b8339e99e5a1",
  "software-engineer-fresher": "2026-09-29@03f169c8d40c",
  "bcom-fresher": "2026-09-29@93d214d393ac",
  "mba-fresher": "2026-09-29@3db031ff5434",
  "bpo-customer-support": "2026-09-29@5bae0498f4fe",
  accountant: "2026-09-10@2ef075e812be",
  "administrative-assistant": "2026-09-10@26bd0e9d301e",
  "customer-service-representative": "2026-09-10@1155309bdcdc",
  "data-analyst": "2026-09-10@848a3c72e44c",
  "financial-analyst": "2026-09-10@df80b91336cf",
  "graduate-no-experience": "2026-09-10@778228d15f6d",
  "graphic-designer": "2026-09-10@facd49c21acb",
  "how-to-quantify-a-bullet": "2026-09-30@3e41a1cc0220",
  "human-resources-manager": "2026-09-10@8ebd99e286b0",
  "marketing-manager": "2026-09-10@f55b47a350c3",
  "mechanical-engineer": "2026-09-10@8942fbf5b03d",
  "project-manager": "2026-09-10@f59a6c9fb30a",
  "registered-nurse": "2026-09-10@4a33ac242415",
  "resume-file-format": "2026-09-30@5f144e0795c7",
  "resume-action-verbs": "2026-09-28@fc907c074407",
  "resume-with-no-experience": "2026-09-30@37a4ddb9f43a",
  "retail-store-manager": "2026-09-10@a34a7123f10d",
  "sales-representative": "2026-09-10@bdaee7676e3a",
  "software-developer": "2026-09-10@01fd55ad4319",
  teacher: "2026-09-10@c8cbf19a77fd",
  "two-column-resume-ats": "2026-09-30@bd52a248e320",
  "what-an-ats-actually-does": "2026-09-30@a4a5bf4c4b94",
  "resume-format-for-freshers": "2026-09-30@94e90db46b97",
  "how-to-write-a-resume-summary": "2026-09-30@756066ca43db",
  "resume-for-campus-placement": "2026-09-30@5b998d7b3bf8",
  "how-long-should-a-resume-be": "2026-09-30@69df8c4afaa4",
  "cv-vs-resume-vs-biodata": "2026-09-30@399ccd18545e",
  "employment-gap-on-resume": "2026-09-30@a7f5ebffbd20",
  "resume-for-naukri": "2026-09-30@17d636b7c235",
  "career-change-resume": "2026-09-30@e2c64559e2e8",
  "resume-for-us-jobs-from-india": "2026-09-30@f568cd26c68e",
  "federal-resume-vs-private-resume": "2026-09-30@6c65190ce5b6",
};

const PAGES = [
  ...ROLE_EXAMPLES.map((example) => ({ kind: "example", entry: example })),
  ...GUIDES.map((guide) => ({ kind: "guide", entry: guide })),
  {
    kind: "reference",
    entry: {
      slug: "resume-action-verbs",
      updated: ACTION_VERBS_UPDATED,
      groups: VERB_GROUPS,
      weak: WEAK_OPENERS,
    },
  },
];

describe("content dates", () => {
  it("are real calendar dates, and none is in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const { entry } of PAGES) {
      expect(isContentDate(entry.updated), `${entry.slug}: "${entry.updated}"`).toBe(true);
      expect(entry.updated <= today, `${entry.slug} is dated ${entry.updated}`).toBe(true);
    }
  });

  it.each(PAGES.map(({ kind, entry }) => [`${kind} ${entry.slug}`, entry] as const))(
    "%s has not changed since the date it shows",
    (_name, entry) => {
      const pin = `${entry.updated}@${contentHash(entry)}`;
      expect(
        PINNED[entry.slug],
        `${entry.slug} changed, or its date did. Set \`updated\` to the day of the change, ` +
          `then pin "${entry.slug}": "${entry.updated}@${contentHash(entry)}".`,
      ).toBe(pin);
    },
  );

  it("formats a date the same way wherever the server is", () => {
    expect(formatContentDate("2026-09-10")).toBe("10 September 2026");
    expect(formatContentDate("2027-01-01")).toBe("1 January 2027");
    expect(() => formatContentDate("10/09/2026")).toThrow();
  });

  it("dates an index by its newest entry", () => {
    expect(latestUpdate([{ updated: "2026-09-10" }, { updated: "2026-10-02" }])).toBe("2026-10-02");
    expect(latestUpdate([])).toBeUndefined();
    expect(isContentDate("2026-02-30")).toBe(false);
  });
});
