/**
 * `.doc`, RTF and HTML — the Word files `/check` used to turn away.
 *
 * The fixtures in `src/test/fixtures/word/` were written by Word itself
 * (Word 16, 2026-10-19) from this repo's own fixture resumes, so they are the
 * bytes a real Word produces rather than what a test author imagines it does.
 * Regenerating them needs Word: render each fixture with `renderDocx`, open
 * it, and Save As "Word 97-2003 Document", "Rich Text Format" and "Web Page,
 * Filtered". `table-layout` was typed into Word directly — a table with the
 * dates in the right-hand cell, and bullets from Word's "List Bullet" style —
 * and `protected` is `fresher` saved with the password "secret".
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { extractLegacyWord } from "./legacy-word";
import { parseResumeFile, type ImportResult } from "./parse-resume";
import {
  foreignFileMessage,
  importKindFromBytes,
  importKindFromFilename,
  readFailureMessage,
} from "./kind";

const FIXTURES = path.join(process.cwd(), "src", "test", "fixtures", "word");

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(FIXTURES, name)));
}

function ascii(text: string): Uint8Array {
  return new Uint8Array([...text].map((c) => c.charCodeAt(0)));
}

function roles(result: ImportResult) {
  const section = result.document.sections.find((s) => s.type === "experience");
  return section?.type === "experience" ? section.entries : [];
}

function projects(result: ImportResult) {
  const section = result.document.sections.find((s) => s.type === "projects");
  return section?.type === "projects" ? section.entries : [];
}

describe("Word's RTF and web-page output", () => {
  it.each(["mid-career.rtf", "mid-career.htm"])(
    "%s reads the way the .doc of the same resume does",
    async (name) => {
      const fromDoc = await parseResumeFile(fixture("mid-career.doc"), "doc");
      const result = await parseResumeFile(fixture(name), "doc");

      expect(result.strategy).toBe("doc");
      // "Ł" is a byte in a Central European font in Word's RTF, and "£" in
      // any other: the font's character set has to be read to get it right.
      expect(result.document.contact.fullName).toBe("José Ángel Muñoz-Łukasiewicz");
      expect(result.document.contact.email).toBe(fromDoc.document.contact.email);
      expect(roles(result).map((r) => [r.title, r.organization, r.bullets.length])).toEqual(
        roles(fromDoc).map((r) => [r.title, r.organization, r.bullets.length]),
      );
    },
  );

  it("reads a web page's lines as Word laid them out, not as its source wraps them", () => {
    const { format, paragraphs } = extractLegacyWord(fixture("mid-career.htm"));
    expect(format).toBe("html");
    expect(paragraphs.map((p) => p.text)).toContain("Senior Backend Engineer Mar 2022 – Present");
  });
});

describe("a table layout with style-based bullets", () => {
  it.each(["table-layout.doc", "table-layout.rtf", "table-layout.docx"])(
    "%s joins a role's cells into one line and finds its bullets",
    async (name) => {
      const result = await parseResumeFile(fixture(name), name.endsWith("x") ? "docx" : "doc");

      const [role] = roles(result);
      expect(role?.title).toBe("Data Analyst");
      expect(role?.organization).toBe("Globex Analytics");
      expect(role?.dates).toEqual({ start: { year: 2022, month: 1 }, end: null, current: true });
      // Set in the cell under the title with no list marker: content, never
      // the employer.
      expect(role?.bullets[0]).toBe("Built weekly churn dashboards for 40 regional managers.");

      // "List Bullet" carries its numbering in the style, not the paragraph.
      expect(projects(result).map((p) => [p.name, p.bullets.length])).toEqual([
        ["Churn Model", 2],
        ["Inventory Forecast", 1],
      ]);
    },
  );
});

describe("files that cannot be read, said plainly", () => {
  it.each(["protected.doc", "protected.docx"])(
    "%s is reported as password-protected",
    async (name) => {
      await expect(parseResumeFile(fixture(name), "doc")).rejects.toThrow(/password-protected/);
    },
  );

  it("reads a .docx that was renamed .doc as the .docx it is", async () => {
    const result = await parseResumeFile(fixture("table-layout.docx"), "doc");
    expect(result.strategy).toBe("docx");
  });

  it("names an OpenDocument file rather than calling it an empty Word document", async () => {
    const odt = zipSync({
      mimetype: strToU8("application/vnd.oasis.opendocument.text"),
      "content.xml": strToU8("<office:document-content/>"),
    });
    await expect(parseResumeFile(odt, "docx")).rejects.toThrow(/OpenDocument/);
  });

  it("names a single-file web page saved as .doc", async () => {
    const mhtml = ascii("MIME-Version: 1.0\r\nContent-Type: multipart/related\r\n\r\n");
    await expect(parseResumeFile(mhtml, "doc")).rejects.toThrow(/MHTML/);
  });

  it("calls a photo a photo", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
    await expect(parseResumeFile(jpeg, "pdf")).rejects.toThrow(/picture of a resume/);
  });

  it("tells a web page saved as .pdf from a damaged PDF, and both from the browser", async () => {
    await expect(parseResumeFile(ascii("<!DOCTYPE html><html>"), "pdf")).rejects.toThrow(
      /web page saved with a \.pdf name/,
    );
    await expect(parseResumeFile(ascii("not a pdf at all"), "pdf")).rejects.toThrow(
      /not a PDF, whatever its name says/,
    );
    await expect(parseResumeFile(ascii("%PDF-1.4\nnothing else"), "pdf")).rejects.toThrow(
      /looks damaged/,
    );
  });
});

describe("RTF details Word relies on", () => {
  const rtf = (body: string) =>
    ascii(
      "{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}" +
        "{\\f1\\fswiss\\fcharset238 Arial CE;}}" +
        body +
        "}",
    );

  it("decodes a byte in its font's character set", () => {
    const { paragraphs } = extractLegacyWord(rtf("\\pard\\plain\\f1 \\'a3ukasz\\par"));
    expect(paragraphs[0]?.text).toBe("Łukasz");
  });

  it("takes a Unicode character and skips its fallback", () => {
    const { paragraphs } = extractLegacyWord(rtf("\\pard Caf\\u233\\'e9 \\par"));
    expect(paragraphs[0]?.text).toBe("Café");
  });

  it("marks a list paragraph by its list text and drops the glyph", () => {
    const { paragraphs } = extractLegacyWord(
      rtf("\\pard{\\listtext\\f0 \\'b7\\tab}Led the team\\par\\pard Not a bullet\\par"),
    );
    expect(paragraphs).toEqual([
      { style: "", text: "Led the team", isListItem: true },
      { style: "", text: "Not a bullet", isListItem: false },
    ]);
  });

  it("keeps a hyperlink's text and drops its instruction", () => {
    const { paragraphs } = extractLegacyWord(
      rtf(
        '\\pard{\\field{\\*\\fldinst HYPERLINK "mailto:a@example.com"}{\\fldrslt a@example.com}}\\par',
      ),
    );
    expect(paragraphs[0]?.text).toBe("a@example.com");
  });
});

describe("knowing a file by its bytes", () => {
  it("finds the format whatever the name says", () => {
    expect(importKindFromBytes(fixture("mid-career.doc"))).toBe("doc");
    expect(importKindFromBytes(fixture("table-layout.docx"))).toBe("docx");
    expect(importKindFromBytes(fixture("mid-career.rtf"))).toBe("doc");
    expect(importKindFromBytes(ascii("junk before the header %PDF-1.7"))).toBe("pdf");
    expect(importKindFromBytes(ascii("plain text"))).toBeNull();
  });

  it("knows .doc and .rtf by name too", () => {
    expect(importKindFromFilename("Resume.DOC")).toBe("doc");
    expect(importKindFromFilename("resume.rtf")).toBe("doc");
  });

  it("recognises pictures and empty files", () => {
    expect(foreignFileMessage(new Uint8Array())).toMatch(/empty/);
    expect(foreignFileMessage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toMatch(/picture/);
    expect(foreignFileMessage(ascii("\0\0\0\x18ftypheic"))).toMatch(/picture/);
    expect(foreignFileMessage(ascii("%PDF-1.7"))).toBeNull();
  });
});

describe("what a screen shows when a read throws", () => {
  it("shows the parser's own message, and never anything else's", () => {
    const ours = Object.assign(new Error("That PDF looks damaged."), { name: "ResumeReadError" });
    expect(readFailureMessage(ours)).toBe("That PDF looks damaged.");

    const consoleError = console.error;
    console.error = () => {};
    try {
      const bug = new TypeError("Cannot read properties of undefined (reading 'text')");
      expect(readFailureMessage(bug)).toMatch(/on our side/);
      expect(readFailureMessage(bug)).not.toMatch(/undefined/);

      const offline = new TypeError("Failed to fetch dynamically imported module");
      expect(readFailureMessage(offline)).toMatch(/connection/);
    } finally {
      console.error = consoleError;
    }
  });
});
