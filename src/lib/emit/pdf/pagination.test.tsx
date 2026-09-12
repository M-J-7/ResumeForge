/**
 * Property-based pagination invariants (M0-T14).
 *
 * P2 shipped a bounded 12-step sweep as the early warning on react-pdf's
 * break control. This is the exhaustive version the plan defers to here:
 * randomly generated content lengths, so the page break lands in places no
 * hand-written fixture would think to put it.
 *
 * The generator is seeded. A property test that fails only on someone else's
 * machine, once, is worse than no test — you cannot reproduce it, so you
 * conclude it was a fluke. With a fixed seed a failure is a permanent,
 * shareable fact, and widening coverage means adding seeds deliberately.
 */

import { describe, expect, it } from "vitest";
import { renderPdf } from "./render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { readPages, type PdfPage } from "@/lib/pdf/read";
import { buildDocument, STANDARD_SECTION_LABELS } from "@/lib/layout/document";
import { longCareerResume } from "@/test/fixtures/resumes";
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, type ResumeDocument } from "@/lib/resume/schema";

/** Deterministic PRNG — mulberry32. Same seed, same documents, every run. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  "migrated",
  "consolidated",
  "reduced",
  "throughput",
  "latency",
  "pipeline",
  "reliability",
  "deployment",
  "observability",
  "customers",
  "quarterly",
  "infrastructure",
];

/**
 * Bullet text is globally unique — role index included — so an assertion
 * failure names exactly one bullet. Reusing "outcome 1" across roles makes
 * substring searches match the wrong bullet and turns a real failure into a
 * puzzle.
 */
function randomBullet(rand: () => number, roleIndex: number, index: number): string {
  // 4–34 words: short enough to sit on one line, long enough to wrap several.
  const length = 4 + Math.floor(rand() * 30);
  const body = Array.from({ length }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(" ");
  return `Role ${roleIndex + 1} outcome ${index}: ${body}.`;
}

/**
 * A resume with randomly sized roles and bullets. Section structure is held
 * fixed — this is testing where breaks land, not whether the schema holds.
 */
function randomResume(seed: number): ResumeDocument {
  const rand = seededRandom(seed);
  const roleCount = 1 + Math.floor(rand() * 6);

  const entries = Array.from({ length: roleCount }, (_, roleIndex) => {
    const bulletCount = 1 + Math.floor(rand() * 6);
    return {
      id: `rand-exp-${roleIndex}`,
      title: `Role Number ${roleIndex + 1}`,
      organization: `Organization ${roleIndex + 1}`,
      location: "Remote",
      dates: {
        start: { year: 2010 + roleIndex, month: 1 + Math.floor(rand() * 12) },
        end: { year: 2012 + roleIndex, month: 1 + Math.floor(rand() * 12) },
        current: false,
      },
      bullets: Array.from({ length: bulletCount }, (_, i) => randomBullet(rand, roleIndex, i + 1)),
    };
  });

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: {
      fullName: "Property Test",
      email: "property@example.com",
      phone: "+1 555 0100",
      location: "Remote",
      links: [],
    },
    sections: [
      { id: "rand-sec-summary", type: "summary", visible: true, content: "" },
      { id: "rand-sec-experience", type: "experience", visible: true, entries },
      ...longCareerResume.sections.filter((s) => s.type === "education" || s.type === "skills"),
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/* -------------------------------------------------------------------------- */
/* Invariants                                                                  */
/* -------------------------------------------------------------------------- */

const SECTION_HEADING_TEXTS = new Set(
  Object.values(STANDARD_SECTION_LABELS).map((l) => l.toUpperCase()),
);

function pageContaining(pages: PdfPage[], needle: string): number | null {
  for (const page of pages) {
    if (page.lines.some((line) => line.text.includes(needle))) return page.pageNumber;
  }
  return null;
}

/** No page ends on a section heading (rule 1). */
function assertNoPageEndsOnHeading(pages: PdfPage[], seed: number) {
  for (const page of pages) {
    const last = page.lines[page.lines.length - 1];
    if (!last) continue;
    expect(
      SECTION_HEADING_TEXTS.has(last.text.trim().toUpperCase()),
      `seed ${seed}: page ${page.pageNumber} ends on heading "${last.text}"`,
    ).toBe(false);
  }
}

/** A role header never splits from its first bullet (rule 2). */
function assertHeaderStaysWithFirstBullet(pages: PdfPage[], doc: ResumeDocument, seed: number) {
  for (const block of buildDocument(doc)) {
    if (block.type !== "experienceEntry" || !block.firstBullet) continue;
    const headerPage = pageContaining(pages, block.title);
    const bulletPage = pageContaining(pages, block.firstBullet.slice(0, 40));
    if (headerPage === null || bulletPage === null) continue;
    expect(bulletPage, `seed ${seed}: "${block.title}" split from its first bullet`).toBe(
      headerPage,
    );
  }
}

/**
 * A bullet never splits mid-content across a page boundary (rule 3).
 *
 * Checks that each bullet's *entire* text is recoverable from a single
 * page. A bullet wraps onto several lines, so the page's lines are joined
 * before searching — if the bullet had been split, its full text would
 * appear on neither page and the count would be zero.
 *
 * Matching on the head and tail separately looks equivalent and is not:
 * with a small vocabulary the tail fragment matches other bullets, which
 * reports splits that never happened.
 */
function assertNoBulletSplits(pages: PdfPage[], doc: ResumeDocument, seed: number) {
  const joined = pages.map((page) => page.lines.map((l) => l.text).join(" "));

  for (const block of buildDocument(doc)) {
    const texts: string[] = [];
    if (block.type === "experienceEntry" && block.firstBullet) texts.push(block.firstBullet);
    if (block.type === "bullet") texts.push(block.text);

    for (const text of texts) {
      const needle = text.replace(/\s+/g, " ").trim();
      const pagesWholeOn = joined.filter((pageText) => pageText.includes(needle)).length;
      expect(
        pagesWholeOn,
        `seed ${seed}: bullet not recoverable from any single page: "${needle.slice(0, 50)}…"`,
      ).toBeGreaterThan(0);
    }
  }
}

/** No page is left with only a stray line or two of a role (rule 4). */
function assertNoStrandedSingleLine(pages: PdfPage[], seed: number) {
  for (const page of pages.slice(1)) {
    expect(
      page.lines.length,
      `seed ${seed}: page ${page.pageNumber} carries only ${page.lines.length} line(s)`,
    ).toBeGreaterThan(1);
  }
}

const SEEDS = Array.from({ length: 24 }, (_, i) => 1000 + i * 37);

describe("pagination invariants over generated content", () => {
  it.each(SEEDS)("holds for seed %i", async (seed) => {
    const doc = randomResume(seed);
    const { bytes, pageCount } = await renderPdf(doc, { resolveFont: nodeFontResolver });
    const pages = await readPages(bytes);

    expect(pages).toHaveLength(pageCount);
    assertNoPageEndsOnHeading(pages, seed);
    assertHeaderStaysWithFirstBullet(pages, doc, seed);
    assertNoBulletSplits(pages, doc, seed);
    assertNoStrandedSingleLine(pages, seed);
  });

  it("actually generates multi-page documents, or it is proving nothing", async () => {
    // A property suite that only ever produces one-page resumes would pass
    // every break-rule assertion vacuously.
    let multiPage = 0;
    for (const seed of SEEDS.slice(0, 12)) {
      const { pageCount } = await renderPdf(randomResume(seed), {
        resolveFont: nodeFontResolver,
      });
      if (pageCount > 1) multiPage += 1;
    }
    expect(multiPage).toBeGreaterThan(0);
  });
});
