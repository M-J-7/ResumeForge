/**
 * M1-T1 and M1-T2 acceptance.
 *
 * The criterion is 100% field recovery on every M0 fixture, and the point of
 * that bar is that anything less is a defect in *our emitters* rather than a
 * limitation of the parser.
 */

import { describe, expect, it } from "vitest";
import {
  extractDocx,
  extractDocxStructure,
  extractPdfGeometric,
  extractPdfStreamOrder,
  strategyDisagreements,
} from "./extract";
import { recoverFields, scoreRecovery } from "./scorecard";
import { renderPdf } from "@/lib/emit/pdf/render";
import { renderDocx } from "@/lib/emit/docx/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { ALL_FIXTURES, midCareerResume } from "@/test/fixtures/resumes";
import type { ResumeDocument } from "@/lib/resume/schema";

async function pdfBytes(doc: ResumeDocument) {
  return (await renderPdf(doc, { resolveFont: nodeFontResolver })).bytes;
}

describe("extraction — both strategies run on every fixture", () => {
  it.each(ALL_FIXTURES)("$name extracts under both PDF strategies", async ({ document }) => {
    const bytes = await pdfBytes(document);
    const streamOrder = await extractPdfStreamOrder(bytes);
    const geometric = await extractPdfGeometric(bytes);

    expect(streamOrder.lines.length).toBeGreaterThan(0);
    expect(geometric.lines.length).toBeGreaterThan(0);
    expect(streamOrder.pageCount).toBe(geometric.pageCount);
  });

  it("is stable across runs", async () => {
    const bytes = await pdfBytes(midCareerResume);
    const first = await extractPdfGeometric(bytes);
    const second = await extractPdfGeometric(bytes);
    expect(first.lines).toEqual(second.lines);
  });

  it("does not consume the caller's buffer", async () => {
    // pdfjs takes ownership of what it is handed; extraction must copy.
    const bytes = await pdfBytes(midCareerResume);
    await extractPdfGeometric(bytes);
    expect(bytes.byteLength).toBeGreaterThan(0);
    await expect(extractPdfStreamOrder(bytes)).resolves.toBeTruthy();
  });

  it("disagrees only where the layout has a right-aligned column", async () => {
    // The two strategies are *meant* to differ here, and M1-T3 shows the user
    // where. A role header is visually one line — title left, date right —
    // so geometric reads it as one line while stream order sees the whole
    // left column, then the right. Both are legitimate readings.
    //
    // What matters is that the disagreement stays confined to those headers
    // rather than scrambling body text, which is what would happen with a
    // genuinely multi-column layout.
    const bytes = await pdfBytes(midCareerResume);
    const streamOrder = await extractPdfStreamOrder(bytes);
    const geometric = await extractPdfGeometric(bytes);

    expect(strategyDisagreements(streamOrder, geometric).length).toBeGreaterThan(0);

    // Every bullet — the actual content — reads identically either way.
    const bullets = geometric.lines.filter((l) => l.startsWith("•"));
    expect(bullets.length).toBeGreaterThan(0);
    for (const bullet of bullets) {
      expect(streamOrder.lines, `bullet reordered: ${bullet}`).toContain(bullet);
    }
  });
});

describe("DOCX extraction", () => {
  it.each(ALL_FIXTURES)("$name extracts text and paragraph styles", async ({ document }) => {
    const { bytes } = await renderDocx(document);
    const extracted = await extractDocx(bytes);
    const structure = extractDocxStructure(bytes);

    expect(extracted.lines.length).toBeGreaterThan(0);
    expect(structure.length).toBeGreaterThan(0);
  });

  it("recovers the named styles a parser relies on (D4)", async () => {
    const { bytes } = await renderDocx(midCareerResume);
    const structure = extractDocxStructure(bytes);
    const styles = new Set(structure.map((p) => p.style));

    expect(styles).toContain("Heading1");
    expect(styles).toContain("Heading2");
    // Bullets are a numbering definition, not literal characters.
    expect(structure.some((p) => p.isListItem)).toBe(true);
  });

  it("marks section headings as Heading1, distinguishing them from job titles", async () => {
    const { bytes } = await renderDocx(midCareerResume);
    const headings = extractDocxStructure(bytes)
      .filter((p) => p.style === "Heading1")
      .map((p) => p.text);
    expect(headings).toEqual(
      expect.arrayContaining(["Summary", "Experience", "Education", "Skills"]),
    );
  });
});

describe("field recovery — 100% on every fixture", () => {
  it.each(ALL_FIXTURES)("$name recovers every field from the PDF", async ({ document }) => {
    const bytes = await pdfBytes(document);
    for (const extract of [extractPdfStreamOrder, extractPdfGeometric]) {
      const extracted = await extract(bytes);
      const card = scoreRecovery(document, recoverFields(extracted), extracted.strategy);
      const failures = card.fields.filter((f) => f.status === "missing" || f.status === "wrong");
      expect(
        failures,
        `${extracted.strategy}: ${failures.map((f) => `${f.field} expected "${f.expected}" got "${f.actual}"`).join("; ")}`,
      ).toEqual([]);
      expect(card.score).toBe(100);
    }
  });

  it.each(ALL_FIXTURES)("$name recovers every field from the DOCX", async ({ document }) => {
    const { bytes } = await renderDocx(document);
    const extracted = await extractDocx(bytes);
    const card = scoreRecovery(document, recoverFields(extracted), extracted.strategy);
    const failures = card.fields.filter((f) => f.status === "missing" || f.status === "wrong");
    expect(
      failures,
      failures.map((f) => `${f.field} expected "${f.expected}" got "${f.actual}"`).join("; "),
    ).toEqual([]);
  });
});

describe("scorecard behaviour", () => {
  it("weights contact details and the most recent role highest", async () => {
    const bytes = await pdfBytes(midCareerResume);
    const card = scoreRecovery(
      midCareerResume,
      recoverFields(await extractPdfGeometric(bytes)),
      "test",
    );
    const weightOf = (field: string) => card.fields.find((f) => f.field === field)?.weight ?? 0;
    expect(weightOf("name")).toBeGreaterThan(weightOf("role.1.title"));
    expect(weightOf("role.0.title")).toBeGreaterThan(weightOf("role.1.title"));
  });

  it("skips fields the user never filled rather than counting them against the score", async () => {
    const bytes = await pdfBytes(midCareerResume);
    const withoutPhone: ResumeDocument = {
      ...midCareerResume,
      contact: { ...midCareerResume.contact, phone: "" },
    };
    const card = scoreRecovery(withoutPhone, recoverFields(await extractPdfGeometric(bytes)), "t");
    expect(card.fields.find((f) => f.field === "phone")?.status).toBe("not-applicable");
  });

  it("reports a missing field rather than silently passing", () => {
    const card = scoreRecovery(
      midCareerResume,
      { name: null, email: null, phone: null, roles: [] },
      "empty",
    );
    expect(card.score).toBe(0);
    expect(card.fields.every((f) => f.status === "missing" || f.status === "not-applicable")).toBe(
      true,
    );
  });

  it("never mistakes an email for a name", () => {
    // The failure this guards: a resume whose name did not render would
    // otherwise "recover" the contact line as the candidate's name.
    const recovered = recoverFields({
      strategy: "pdf-geometric",
      lines: ["jose.munoz@example.com | +34 612 345 678", "EXPERIENCE"],
      text: "jose.munoz@example.com | +34 612 345 678\nEXPERIENCE",
      pageCount: 1,
    });
    expect(recovered.name).toBeNull();
  });

  it("does not mistake a quantified outcome for a phone number", () => {
    const recovered = recoverFields({
      strategy: "pdf-geometric",
      lines: ["Cut latency from 400ms to 90ms across 12 markets in 2023"],
      text: "Cut latency from 400ms to 90ms across 12 markets in 2023",
      pageCount: 1,
    });
    expect(recovered.phone).toBeNull();
  });
});

/**
 * M1-T3 acceptance: a deliberately broken document surfaces visible
 * failures, while a clean one scores 100%.
 *
 * Our own emitters structurally cannot produce a broken layout — there is no
 * code path for a photo, a two-column body, or contact details in a page
 * header. So the failure modes are simulated at the extraction boundary,
 * which is where they would actually arrive from an imported file (M4-T1).
 */
describe("broken documents surface visible failures", () => {
  const truth = midCareerResume;

  it("reports the name missing when contact sits in a page header a parser drops", () => {
    // The classic failure: contact details placed in a PDF header, which many
    // parsers never read. The body then starts at the first section heading.
    const recovered = recoverFields({
      strategy: "pdf-geometric",
      lines: ["SUMMARY", "Backend engineer with seven years building payment infrastructure."],
      text: "SUMMARY\nBackend engineer with seven years building payment infrastructure.",
      pageCount: 1,
    });
    const card = scoreRecovery(truth, recovered, "broken-header");

    expect(card.score).toBeLessThan(100);
    expect(card.fields.find((f) => f.field === "email")?.status).toBe("missing");
    expect(card.fields.find((f) => f.field === "phone")?.status).toBe("missing");
  });

  it("reports roles missing when a two-column layout interleaves them", () => {
    // What a naive parser does to side-by-side columns: the two columns'
    // lines alternate, so no role header sits next to its own dates.
    const recovered = recoverFields({
      strategy: "pdf-stream-order",
      lines: [
        "José Ángel Muñoz-Łukasiewicz",
        "jose.munoz@example.com",
        "SKILLS Senior Backend Engineer",
        "Go, TypeScript Contoso Payments",
      ],
      text: "José Ángel Muñoz-Łukasiewicz\njose.munoz@example.com\nSKILLS Senior Backend Engineer\nGo, TypeScript Contoso Payments",
      pageCount: 1,
    });
    const card = scoreRecovery(truth, recovered, "broken-columns");

    // Contact still recovers; the roles do not, which is exactly the
    // distinction a user needs to see.
    expect(card.fields.find((f) => f.field === "name")?.status).toBe("recovered");
    expect(card.fields.find((f) => f.field === "role.0.title")?.status).toBe("missing");
    expect(card.score).toBeLessThan(100);
  });

  it("scores a clean document at 100%, so the broken cases mean something", async () => {
    const bytes = await pdfBytes(truth);
    const extracted = await extractPdfGeometric(bytes);
    expect(scoreRecovery(truth, recoverFields(extracted), extracted.strategy).score).toBe(100);
  });
});
