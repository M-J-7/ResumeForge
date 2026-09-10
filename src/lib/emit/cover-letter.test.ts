/**
 * A cover letter through all three emitters (P28-I2).
 *
 * The point of these is not that a letter renders — it is that it renders
 * through the *resume's* pipeline. Every assertion below would also hold for
 * a parallel letter-only renderer; what makes them worth having is that they
 * fail loudly if someone adds one, because the letter would then stop
 * inheriting the resume's page geometry, styles and break rules.
 */

import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { DEFAULT_SETTINGS } from "@/lib/resume/schema";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { readTextByPage } from "@/lib/pdf/read";
import { buildCoverLetterDocument } from "@/lib/layout/cover-letter";
import { coverLetterFileName } from "./filename";
import {
  renderCoverLetterDocx,
  renderCoverLetterPdf,
  renderCoverLetterText,
} from "./cover-letter";
import {
  CURRENT_COVER_LETTER_SCHEMA_VERSION,
  DEFAULT_SALUTATION,
  DEFAULT_SIGN_OFF,
  type CoverLetterDocument,
} from "@/lib/cover-letter/schema";

/** Fixed, so every rendered artefact in this file is deterministic. */
const TODAY = new Date(2026, 8, 1);

const letter: CoverLetterDocument = {
  schemaVersion: CURRENT_COVER_LETTER_SCHEMA_VERSION,
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+44 20 7946 0000",
    location: "London",
    links: [],
  },
  recipient: {
    name: "Grace Hopper",
    title: "Head of Engineering",
    company: "Acme",
    address: "14 Bridge Street\nLondon EC1",
  },
  dateISO: null,
  salutation: DEFAULT_SALUTATION,
  paragraphs: [
    {
      id: "opening",
      role: "opening",
      text: "I am writing about the Senior Platform Engineer role at Acme.",
      sources: [],
    },
    {
      id: "evidence",
      role: "evidence",
      text: "At Meridian Health, I cut median deploy time from 38 minutes to 6.",
      sources: ["exp-1"],
    },
    { id: "closing", role: "closing", text: "I would be glad to talk through any of it.", sources: [] },
  ],
  signOff: DEFAULT_SIGN_OFF,
  settings: { ...DEFAULT_SETTINGS },
};

describe("buildCoverLetterDocument", () => {
  it("opens with the resume's own contact block", () => {
    const blocks = buildCoverLetterDocument(letter, TODAY);
    expect(blocks[0]).toMatchObject({ type: "contact", fullName: "Ada Lovelace" });
  });

  it("stamps today's date when the letter has none", () => {
    const blocks = buildCoverLetterDocument(letter, TODAY);
    expect(blocks[1]).toMatchObject({ type: "letterMeta", date: "1 September 2026" });
  });

  it("uses the letter's own date when it has one, in local time", () => {
    const blocks = buildCoverLetterDocument({ ...letter, dateISO: "2026-03-04" }, TODAY);
    // Not "3 March" — `new Date("2026-03-04")` is UTC midnight, which is the
    // 3rd anywhere west of Greenwich.
    expect(blocks[1]).toMatchObject({ date: "4 March 2026" });
  });

  it("drops empty recipient fields rather than leaving blank lines", () => {
    const blocks = buildCoverLetterDocument(
      { ...letter, recipient: { name: "", title: "", company: "Acme", address: "" } },
      TODAY,
    );
    expect(blocks[1]).toMatchObject({ recipientLines: ["Acme"] });
  });

  it("skips an empty paragraph, which is a normal editing state", () => {
    const withBlank: CoverLetterDocument = {
      ...letter,
      paragraphs: [
        ...letter.paragraphs,
        { id: "blank", role: "custom", text: "   ", sources: [] },
      ],
    };
    const paragraphs = buildCoverLetterDocument(withBlank, TODAY).filter(
      (block) => block.type === "paragraph",
    );
    // Salutation + three paragraphs + sign-off. The blank one is not there.
    expect(paragraphs).toHaveLength(5);
  });
});

describe("plain text", () => {
  const text = renderCoverLetterText(letter, TODAY);

  it("contains the letterhead, date, recipient, body and sign-off", () => {
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("1 September 2026");
    expect(text).toContain("Grace Hopper");
    expect(text).toContain("14 Bridge Street");
    expect(text).toContain(DEFAULT_SALUTATION);
    expect(text).toContain("cut median deploy time");
    expect(text).toContain(DEFAULT_SIGN_OFF);
  });

  it("wraps prose rather than emitting one very long line", () => {
    const long = renderCoverLetterText(
      {
        ...letter,
        paragraphs: [
          { id: "p", role: "custom", text: "word ".repeat(80).trim(), sources: [] },
        ],
      },
      TODAY,
    );
    for (const line of long.split("\n")) expect(line.length).toBeLessThanOrEqual(78);
  });

  it("ends with a single trailing newline", () => {
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });
});

describe("DOCX", () => {
  it("recovers every sentence through mammoth", async () => {
    const { bytes } = await renderCoverLetterDocx(letter, TODAY);
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });

    expect(value).toContain("Ada Lovelace");
    expect(value).toContain("1 September 2026");
    expect(value).toContain("Grace Hopper");
    expect(value).toContain(DEFAULT_SALUTATION);
    expect(value).toContain("cut median deploy time from 38 minutes to 6");
    expect(value).toContain(DEFAULT_SIGN_OFF);
  });

  it("contains no table, text box, or image — the same hard constraints as the resume", async () => {
    const { bytes } = await renderCoverLetterDocx(letter, TODAY);
    const { unzipSync, strFromU8 } = await import("fflate");
    const document = unzipSync(bytes)["word/document.xml"];
    expect(document).toBeDefined();

    const xml = strFromU8(document!);
    expect(xml).not.toContain("<w:tbl>");
    expect(xml).not.toContain("<w:txbxContent>");
    expect(xml).not.toContain("<w:drawing>");
  });
});

describe("PDF", () => {
  it("renders one page carrying the letter's text", async () => {
    const { bytes, pageCount } = await renderCoverLetterPdf(
      letter,
      { resolveFont: nodeFontResolver },
      TODAY,
    );

    expect(pageCount).toBe(1);
    const [page] = await readTextByPage(bytes);
    expect(page).toContain("Ada Lovelace");
    expect(page).toContain("1 September 2026");
    expect(page).toContain("Grace Hopper");
    expect(page).toContain("38 minutes");
  }, 30_000);
});

describe("filenames", () => {
  it("follows the resume's convention so the pair sorts together", () => {
    expect(coverLetterFileName("Ada Lovelace", "pdf")).toBe("Ada_Lovelace_Cover_Letter.pdf");
    expect(coverLetterFileName("Ada Lovelace", "docx")).toBe("Ada_Lovelace_Cover_Letter.docx");
  });

  it("falls back cleanly before a name is entered", () => {
    expect(coverLetterFileName("", "txt")).toBe("Cover_Letter.txt");
  });

  it("transliterates, exactly as the resume's does", () => {
    expect(coverLetterFileName("José Ángel Muñoz-Łukasiewicz", "pdf")).toBe(
      "Jose_Angel_Munoz-Lukasiewicz_Cover_Letter.pdf",
    );
  });
});
