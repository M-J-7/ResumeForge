/**
 * M0-T5 acceptance.
 *
 * The criterion "opens clean in Word, LibreOffice, and Google Docs" cannot be
 * asserted from Node — it needs those applications. What *is* asserted here
 * is everything that determines whether they will: a valid OPC package, real
 * named paragraph styles, native numbering rather than literal bullet
 * characters, correct page geometry, and none of the constructs (tables,
 * images, headers, footers, text boxes) that cause parse failures. The
 * application-level pass is a manual step, recorded in docs/QA.md per M0-T14.
 *
 * Cross-format page parity with the PDF is likewise not assertable without a
 * Word-compatible layout engine; M0-T14 owns it as a manual check.
 */

import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import mammoth from "mammoth";
import { renderDocx } from "./render";
import { PAGE_SIZE_TWIPS, STYLE_IDS, inchesToTwips } from "./styles";
import { renderText } from "@/lib/emit/text/render";
import { buildDocument } from "@/lib/layout/document";
import { ALL_FIXTURES, midCareerResume, longCareerResume } from "@/test/fixtures/resumes";
import { FONT_PAIRS, FONT_PAIR_IDS } from "@/lib/fonts/pairs";
import type { ResumeDocument } from "@/lib/resume/schema";

async function docxParts(resume: ResumeDocument) {
  const { bytes } = await renderDocx(resume);
  const files = unzipSync(bytes);
  const read = (name: string) => {
    const file = files[name];
    return file ? strFromU8(file) : null;
  };
  return { bytes, files, read };
}

async function extractText(resume: ResumeDocument): Promise<string> {
  const { bytes } = await renderDocx(resume);
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

/* -------------------------------------------------------------------------- */
/* Package validity                                                            */
/* -------------------------------------------------------------------------- */

describe("package structure", () => {
  it("produces a valid OPC package with the parts Word requires", async () => {
    const { files, bytes } = await docxParts(midCareerResume);
    // A DOCX is a ZIP; "PK" is the local file header signature.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/styles.xml",
      "word/numbering.xml",
    ]) {
      expect(Object.keys(files), `missing part ${part}`).toContain(part);
    }
  });

  it.each(ALL_FIXTURES)("$name produces well-formed document XML", async ({ document }) => {
    const { read } = await docxParts(document);
    const xml = read("word/document.xml");
    expect(xml).toBeTruthy();
    expect(xml).toContain("<w:document");
    expect(xml).toContain("</w:document>");
  });
});

/* -------------------------------------------------------------------------- */
/* Named styles — the reason DOCX parses well (D4)                             */
/* -------------------------------------------------------------------------- */

describe("named paragraph styles", () => {
  it("defines the real Word style ids rather than ad-hoc names", async () => {
    const { read } = await docxParts(midCareerResume);
    const styles = read("word/styles.xml") ?? "";
    for (const id of Object.values(STYLE_IDS)) {
      expect(styles, `style ${id} not defined`).toContain(`w:styleId="${id}"`);
    }
  });

  it("marks section headings as Heading1 with an outline level", async () => {
    const { read } = await docxParts(midCareerResume);
    const styles = read("word/styles.xml") ?? "";
    expect(styles).toContain(`w:styleId="${STYLE_IDS.sectionHeading}"`);
    expect(styles).toContain('<w:outlineLvl w:val="0"');
  });

  it("references a style on every content paragraph", async () => {
    const { read } = await docxParts(midCareerResume);
    const xml = read("word/document.xml") ?? "";
    const paragraphs = xml.match(/<w:p>|<w:p [^>]*>/g) ?? [];
    const styleRefs = xml.match(/<w:pStyle /g) ?? [];
    // Every paragraph we emit carries a style; allow for the section-
    // properties paragraph docx appends, which carries none.
    expect(styleRefs.length).toBeGreaterThanOrEqual(paragraphs.length - 1);
  });

  it("carries the heading text as real text, not as a style name only", async () => {
    const text = await extractText(midCareerResume);
    for (const heading of ["Summary", "Experience", "Education", "Skills"]) {
      expect(text).toContain(heading);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Bullets via native numbering, not literal characters                        */
/* -------------------------------------------------------------------------- */

describe("bullets", () => {
  it("defines a numbering definition and references it from bullet paragraphs", async () => {
    const { read } = await docxParts(midCareerResume);
    const numbering = read("word/numbering.xml") ?? "";
    const xml = read("word/document.xml") ?? "";
    expect(numbering).toContain("<w:abstractNum");
    expect(numbering).toContain('<w:numFmt w:val="bullet"');
    expect(xml).toContain("<w:numPr>");
  });

  it("never writes a literal bullet character into the body text", async () => {
    for (const { document } of ALL_FIXTURES) {
      const text = await extractText(document);
      expect(text).not.toContain("•");
    }
    // The glyph belongs in the list definition, where a parser can strip it.
    const { read } = await docxParts(midCareerResume);
    expect(read("word/numbering.xml")).toContain("•");
  });

  it("puts every bullet's text into the document", async () => {
    const text = await extractText(midCareerResume);
    for (const block of buildDocument(midCareerResume)) {
      if (block.type === "bullet") expect(text).toContain(block.text);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Break hints map to Word's native equivalents                                */
/* -------------------------------------------------------------------------- */

describe("break hints", () => {
  it("emits keepNext and keepLines", async () => {
    const { read } = await docxParts(longCareerResume);
    const xml = read("word/document.xml") ?? "";
    expect(xml).toContain("<w:keepNext");
    expect(xml).toContain("<w:keepLines");
  });

  it("keeps a section heading with what follows it", async () => {
    const { read } = await docxParts(midCareerResume);
    const xml = read("word/document.xml") ?? "";
    // Isolate the first Heading1 paragraph and check its properties.
    const idx = xml.indexOf(`w:val="${STYLE_IDS.sectionHeading}"`);
    expect(idx).toBeGreaterThan(-1);
    const paragraphStart = xml.lastIndexOf("<w:p", idx);
    const paragraphEnd = xml.indexOf("</w:p>", idx);
    const paragraph = xml.slice(paragraphStart, paragraphEnd);
    expect(paragraph).toContain("<w:keepNext");
  });

  it("keeps every bullet's lines together so none splits mid-content", async () => {
    const { read } = await docxParts(longCareerResume);
    const xml = read("word/document.xml") ?? "";
    const bulletParagraphs = xml
      .split("<w:p>")
      .filter((p) => p.includes(`w:val="${STYLE_IDS.bullet}"`));
    expect(bulletParagraphs.length).toBeGreaterThan(0);
    for (const paragraph of bulletParagraphs) {
      expect(paragraph).toContain("<w:keepLines");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Page geometry                                                               */
/* -------------------------------------------------------------------------- */

describe("page geometry", () => {
  it.each(["A4", "LETTER"] as const)("uses the exact %s size in twips", async (pageSize) => {
    const { read } = await docxParts({
      ...midCareerResume,
      settings: { ...midCareerResume.settings, pageSize },
    });
    const xml = read("word/document.xml") ?? "";
    const { width, height } = PAGE_SIZE_TWIPS[pageSize];
    expect(xml).toContain(`w:w="${width}"`);
    expect(xml).toContain(`w:h="${height}"`);
  });

  it("converts margins from the shared settings", async () => {
    const margins = 0.5;
    const { read } = await docxParts({
      ...midCareerResume,
      settings: { ...midCareerResume.settings, margins },
    });
    const xml = read("word/document.xml") ?? "";
    expect(xml).toContain(`w:top="${inchesToTwips(margins)}"`);
    expect(xml).toContain(`w:left="${inchesToTwips(margins)}"`);
  });
});

/* -------------------------------------------------------------------------- */
/* Fonts by name, never embedded (D5)                                          */
/* -------------------------------------------------------------------------- */

describe("fonts", () => {
  it.each(FONT_PAIR_IDS)(
    "references %s's real font name rather than the OFL twin",
    async (fontPair) => {
      const { read, files } = await docxParts({
        ...midCareerResume,
        settings: { ...midCareerResume.settings, fontPair },
      });
      const styles = read("word/styles.xml") ?? "";
      expect(styles).toContain(FONT_PAIRS[fontPair].docxName);

      // Naming a font is not redistribution; embedding one is. `fontTable.xml`
      // is a normal part that *declares* fonts — embedding shows up as
      // `w:embedRegular` and friends pointing at .odttf binaries.
      const fontTable = read("word/fontTable.xml") ?? "";
      expect(fontTable).not.toMatch(/w:embed(Regular|Bold|Italic|BoldItalic)/);
      for (const name of Object.keys(files)) {
        expect(name).not.toMatch(/\.(ttf|otf|odttf|woff2?)$/i);
      }
    },
  );

  it("never names the OFL twin we embed in the PDF", async () => {
    // The PDF embeds Arimo; the DOCX must say "Arial". Leaking the twin's
    // name would render with a font the reader almost certainly lacks.
    const { read } = await docxParts({
      ...midCareerResume,
      settings: { ...midCareerResume.settings, fontPair: "modern" },
    });
    const styles = read("word/styles.xml") ?? "";
    expect(styles).toContain("Arial");
    expect(styles).not.toContain("Arimo");
  });
});

/* -------------------------------------------------------------------------- */
/* Hard constraints                                                            */
/* -------------------------------------------------------------------------- */

describe("hard constraints", () => {
  it.each(ALL_FIXTURES)(
    "$name contains no table, image, text box, header, or footer",
    async ({ document }) => {
      const { read, files } = await docxParts(document);
      const xml = read("word/document.xml") ?? "";
      expect(xml).not.toContain("<w:tbl>");
      expect(xml).not.toContain("<w:drawing>");
      expect(xml).not.toContain("<w:pict>");
      expect(xml).not.toContain("<w:txbxContent>");
      expect(xml).not.toContain("<w:headerReference");
      expect(xml).not.toContain("<w:footerReference");
      for (const name of Object.keys(files)) {
        expect(name).not.toMatch(/^word\/(header|footer)\d*\.xml$/);
        expect(name).not.toMatch(/^word\/media\//);
      }
    },
  );
});

/* -------------------------------------------------------------------------- */
/* Parity with the TXT emitter                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reduces either emitter's output to the sequence of content words.
 *
 * The two formats legitimately differ in presentation: TXT uppercases
 * section headings and joins a heading to its date with " | ", while DOCX
 * relies on `allCaps` (a display property, so the underlying text keeps its
 * case) and a right tab stop. Neither difference is content. Normalizing
 * case, separators we inject, bullet markers, and whitespace leaves exactly
 * the words — and asserting those match in order is the real claim: the
 * DOCX emitter drops, duplicates, and reorders nothing.
 */
function contentWords(raw: string): string[] {
  return raw
    .replace(/–/g, "-") // en dash -> hyphen, matching the TXT fold
    .replace(/[|\t]/g, " ") // injected separators
    .replace(/^[-•]\s+/gm, "") // bullet markers
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

describe("parity with the TXT emitter", () => {
  it.each(ALL_FIXTURES)("$name recovers the same words in the same order", async ({ document }) => {
    const fromDocx = contentWords(await extractText(document));
    const fromText = contentWords(renderText(document));
    expect(fromDocx).toEqual(fromText);
  });
});
