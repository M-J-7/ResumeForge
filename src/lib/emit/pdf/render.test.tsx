/**
 * M0-T4 acceptance: golden extracted text, determinism, and the break rules.
 *
 * Per plan §2.5, the pagination invariants ship here in P2 rather than
 * waiting for M0-T14 in P6. They are the natural trigger for the top entry
 * in the risk register — react-pdf's declarative break control proving
 * insufficient — and surfacing that at ~31 hours instead of ~91, before the
 * whole builder UI is built on the assumption, is the entire point.
 */

import { describe, expect, it } from "vitest";
import { renderPdf } from "./render";
import { pdfFingerprint } from "./determinism";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { readPages, type PdfPage } from "@/lib/pdf/read";
import { buildDocument, STANDARD_SECTION_LABELS } from "@/lib/layout/document";
import { ALL_FIXTURES, buildOverflowFixture, midCareerResume } from "@/test/fixtures/resumes";
import { FONT_PAIR_IDS } from "@/lib/fonts/pairs";
import type { ResumeDocument } from "@/lib/resume/schema";

async function render(resume: ResumeDocument) {
  return renderPdf(resume, { resolveFont: nodeFontResolver });
}

/* -------------------------------------------------------------------------- */
/* Golden extracted text                                                       */
/* -------------------------------------------------------------------------- */

describe("golden extracted text", () => {
  it.each(ALL_FIXTURES)("$name extracts to stable text", async ({ name, document }) => {
    const { bytes, pageCount } = await render(document);
    const pages = await readPages(bytes);
    const snapshot = pages
      .map((p) => `--- page ${p.pageNumber} ---\n${p.lines.map((l) => l.text).join("\n")}`)
      .join("\n");

    expect(pages).toHaveLength(pageCount);
    await expect(snapshot).toMatchFileSnapshot(`./__snapshots__/${name}.txt`);
  });
});

/* -------------------------------------------------------------------------- */
/* Determinism                                                                 */
/* -------------------------------------------------------------------------- */

describe("determinism", () => {
  it("produces an identical document across repeated renders", async () => {
    const fingerprints: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const { bytes } = await render(midCareerResume);
      fingerprints.push(pdfFingerprint(bytes));
    }
    expect(new Set(fingerprints).size).toBe(1);
  });

  it("produces the same byte length every run, so nothing about the content varies", async () => {
    const lengths = new Set<number>();
    for (let i = 0; i < 4; i += 1) {
      const { bytes } = await render(midCareerResume);
      lengths.add(bytes.byteLength);
    }
    expect(lengths.size).toBe(1);
  });

  it("still reflects a real content change", async () => {
    const changed: ResumeDocument = {
      ...midCareerResume,
      contact: { ...midCareerResume.contact, fullName: "Someone Else Entirely" },
    };
    const a = await render(midCareerResume);
    const b = await render(changed);
    expect(pdfFingerprint(a.bytes)).not.toEqual(pdfFingerprint(b.bytes));
  });

  it("reflects a settings change that alters layout", async () => {
    const a = await render(midCareerResume);
    const b = await render({
      ...midCareerResume,
      settings: { ...midCareerResume.settings, margins: 0.5 },
    });
    expect(pdfFingerprint(a.bytes)).not.toEqual(pdfFingerprint(b.bytes));
  });
});

/* -------------------------------------------------------------------------- */
/* Page count is measured, not estimated (D3)                                  */
/* -------------------------------------------------------------------------- */

describe("page count", () => {
  it("matches the number of pages actually present in the artifact", async () => {
    const { bytes, pageCount } = await render(buildOverflowFixture(14));
    const pages = await readPages(bytes);
    expect(pageCount).toBe(pages.length);
    expect(pageCount).toBeGreaterThan(1);
  });

  it("grows as content grows", async () => {
    const small = await render(buildOverflowFixture(1));
    const large = await render(buildOverflowFixture(30));
    expect(large.pageCount).toBeGreaterThan(small.pageCount);
  });

  it("treats A4 and Letter as first-class — they paginate differently", async () => {
    // A4 is ~6% taller than Letter, so the same content breaks at a
    // different point. Needs content that actually spans a page boundary
    // for the difference to be observable at all.
    const base = buildOverflowFixture(14);
    const a4 = await render({ ...base, settings: { ...base.settings, pageSize: "A4" } });
    const letter = await render({ ...base, settings: { ...base.settings, pageSize: "LETTER" } });

    const a4Pages = await readPages(a4.bytes);
    const letterPages = await readPages(letter.bytes);

    // Same content, so the same total lines exist; what differs is the split.
    expect(a4Pages.flatMap((p) => p.lines).length).toBe(letterPages.flatMap((p) => p.lines).length);
    expect(a4Pages[0]?.lines.length).not.toBe(letterPages[0]?.lines.length);
  });
});

/* -------------------------------------------------------------------------- */
/* Layout sanity — the regression guard for the lineHeight inheritance bug     */
/* -------------------------------------------------------------------------- */

/**
 * react-pdf resolves a unitless `lineHeight` to an absolute value at the
 * element declaring it, and descendants inherit that absolute value rather
 * than the ratio. Any style that sets `fontSize` without restating
 * `lineHeight` therefore gets a line box sized for the *parent's* font and
 * collides with the line below it. This caught exactly that on the name and
 * section headings; it stays as the guard against reintroducing it.
 */
function overlappingLines(page: PdfPage): string[] {
  const problems: string[] = [];
  for (let i = 0; i < page.lines.length - 1; i += 1) {
    const upper = page.lines[i];
    const lower = page.lines[i + 1];
    if (!upper || !lower) continue;
    const gap = upper.y - lower.y;
    // The lower line's glyphs rise from its baseline by roughly its height;
    // if the baselines are closer than that, the two lines collide.
    if (gap < lower.height * 0.95) {
      problems.push(
        `"${upper.text.slice(0, 40)}" / "${lower.text.slice(0, 40)}" gap=${gap.toFixed(1)} needs>=${(lower.height * 0.95).toFixed(1)}`,
      );
    }
  }
  return problems;
}

describe("layout sanity", () => {
  it.each(ALL_FIXTURES)("$name renders no overlapping lines", async ({ document }) => {
    const { bytes } = await render(document);
    for (const page of await readPages(bytes)) {
      expect(overlappingLines(page)).toEqual([]);
    }
  });

  it("renders no overlapping lines for any font pair", async () => {
    for (const fontPair of FONT_PAIR_IDS) {
      const { bytes } = await render({
        ...midCareerResume,
        settings: { ...midCareerResume.settings, fontPair },
      });
      for (const page of await readPages(bytes)) {
        expect(overlappingLines(page), `font pair: ${fontPair}`).toEqual([]);
      }
    }
  });

  it.each(ALL_FIXTURES)("$name keeps every line inside the page margins", async ({ document }) => {
    // Text pushed past the right edge is not merely ugly — it is clipped, so
    // the words are gone from both the print and the extracted text. The
    // long-organization fixture exists to put pressure on exactly this.
    const marginPt = document.settings.margins * 72;
    const { bytes } = await render(document);
    for (const page of await readPages(bytes)) {
      const rightEdge = page.widthPt - marginPt;
      for (const line of page.lines) {
        for (const item of line.items) {
          expect(item.x, `left overflow: ${item.text}`).toBeGreaterThanOrEqual(marginPt - 1);
          expect(item.x, `right overflow: ${item.text}`).toBeLessThanOrEqual(rightEdge + 1);
        }
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Break rules (M0-T3 hints, enforced by the PDF emitter)                      */
/* -------------------------------------------------------------------------- */

const SECTION_HEADING_TEXTS = new Set(
  Object.values(STANDARD_SECTION_LABELS).map((l) => l.toUpperCase()),
);

/** Section headings render uppercased via textTransform, so compare uppercased. */
function isSectionHeading(lineText: string): boolean {
  return SECTION_HEADING_TEXTS.has(lineText.trim().toUpperCase());
}

function pageOf(pages: PdfPage[], predicate: (line: string) => boolean): number | null {
  for (const page of pages) {
    if (page.lines.some((l) => predicate(l.text))) return page.pageNumber;
  }
  return null;
}

/** Rule 1: a section heading never ends a page. */
function assertNoPageEndsOnSectionHeading(pages: PdfPage[]) {
  for (const page of pages) {
    const last = page.lines[page.lines.length - 1];
    if (!last) continue;
    expect(
      isSectionHeading(last.text),
      `page ${page.pageNumber} ends on heading "${last.text}"`,
    ).toBe(false);
  }
}

/** Rule 2: a role header and its first bullet always share a page. */
function assertRoleHeaderStaysWithFirstBullet(pages: PdfPage[], resume: ResumeDocument) {
  for (const block of buildDocument(resume)) {
    if (block.type !== "experienceEntry" || !block.firstBullet) continue;
    const headerPage = pageOf(pages, (l) => l.includes(block.title) && block.title.length > 0);
    const bulletText = block.firstBullet.slice(0, 45);
    const bulletPage = pageOf(pages, (l) => l.includes(bulletText));
    if (headerPage === null || bulletPage === null) continue;
    expect(bulletPage, `role "${block.title}" split from its first bullet`).toBe(headerPage);
  }
}

/**
 * Rule 3: a bullet never splits mid-content across a page boundary.
 *
 * A bullet that wraps onto several lines must have all of them on one page,
 * so its *entire* text has to be recoverable from a single page once that
 * page's lines are joined. Comparing a head fragment against a tail fragment
 * looks equivalent but is not — a tail short enough to match reliably is
 * also short enough to match a different bullet, which reports splits that
 * never happened.
 */
function assertNoBulletSplitsAcrossPages(pages: PdfPage[], resume: ResumeDocument) {
  const joined = pages.map((page) => page.lines.map((l) => l.text).join(" "));

  for (const block of buildDocument(resume)) {
    const texts: string[] = [];
    if ((block.type === "experienceEntry" || block.type === "projectEntry") && block.firstBullet) {
      texts.push(block.firstBullet);
    }
    if (block.type === "bullet") texts.push(block.text);

    for (const text of texts) {
      const needle = text.replace(/\s+/g, " ").trim();
      const wholeOn = joined.filter((pageText) => pageText.includes(needle)).length;
      expect(
        wholeOn,
        `bullet not recoverable from any single page: "${needle.slice(0, 45)}…"`,
      ).toBeGreaterThan(0);
    }
  }
}

describe("break rules — static fixtures", () => {
  it.each(ALL_FIXTURES)("$name satisfies every break rule", async ({ document }) => {
    const { bytes } = await render(document);
    const pages = await readPages(bytes);
    assertNoPageEndsOnSectionHeading(pages);
    assertRoleHeaderStaysWithFirstBullet(pages, document);
    assertNoBulletSplitsAcrossPages(pages, document);
  });
});

/**
 * The sweep is what actually exercises the break control. Two static
 * fixtures can both pass by luck — their page break may simply never land
 * near a role boundary. Varying the final role's bullet count walks the
 * break across the boundary one line at a time, so if react-pdf cannot hold
 * a role header to its first bullet declaratively, some iteration here will
 * prove it. The exhaustive property test over random content stays in
 * M0-T14.
 */
describe("break rules — page-boundary sweep", () => {
  const bulletCounts = Array.from({ length: 12 }, (_, i) => i + 1);

  it.each(bulletCounts)("holds with %i bullets on the final role", async (count) => {
    const fixture = buildOverflowFixture(count);
    const { bytes } = await render(fixture);
    const pages = await readPages(bytes);
    assertNoPageEndsOnSectionHeading(pages);
    assertRoleHeaderStaysWithFirstBullet(pages, fixture);
    assertNoBulletSplitsAcrossPages(pages, fixture);
  });
});

/* -------------------------------------------------------------------------- */
/* Hard constraints — the emitter has no capability to violate these           */
/* -------------------------------------------------------------------------- */

describe("hard constraints", () => {
  it("embeds no images", async () => {
    const { bytes } = await render(midCareerResume);
    const raw = Buffer.from(bytes).toString("latin1");
    expect(raw).not.toContain("/Subtype /Image");
  });

  it("emits real, extractable text rather than drawn outlines", async () => {
    const { bytes } = await render(midCareerResume);
    const pages = await readPages(bytes);
    expect(pages[0]?.text).toContain("José Ángel Muñoz-Łukasiewicz");
    expect(pages[0]?.text).toContain("jose.munoz@example.com");
  });

  it("never splits a word with an inserted hyphen", async () => {
    const { bytes } = await render(midCareerResume);
    const pages = await readPages(bytes);
    for (const page of pages) {
      for (const line of page.lines) {
        expect(line.text, `hyphenated line: ${line.text}`).not.toMatch(/\w-$/);
      }
    }
  });
});
