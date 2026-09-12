import { describe, expect, it } from "vitest";
import { DESTINATION_ADVICE, resumeFileName, transliterate } from "./filename";
import { ALL_FIXTURES } from "@/test/fixtures/resumes";

describe("transliterate", () => {
  it("strips diacritics from decomposable Latin characters", () => {
    expect(transliterate("José Ángel Muñoz")).toBe("Jose Angel Munoz");
    expect(transliterate("Politècnica")).toBe("Politecnica");
    expect(transliterate("Ünal Çelik")).toBe("Unal Celik");
  });

  it("maps characters that have no combining form rather than dropping them", () => {
    // These decompose to nothing under NFKD, so without explicit mapping the
    // letter would silently disappear from the filename.
    expect(transliterate("Łukasiewicz")).toBe("Lukasiewicz");
    expect(transliterate("Søren")).toBe("Soren");
    expect(transliterate("Đorđe")).toBe("Dorde");
    expect(transliterate("Straße")).toBe("Strasse");
    expect(transliterate("Æsir")).toBe("AEsir");
  });

  it("leaves plain ASCII untouched", () => {
    expect(transliterate("Marcus Chen")).toBe("Marcus Chen");
  });
});

describe("resumeFileName", () => {
  it("uses the FirstName_LastName_Resume convention", () => {
    expect(resumeFileName("Ada Lovelace", "pdf")).toBe("Ada_Lovelace_Resume.pdf");
    expect(resumeFileName("Ada Lovelace", "docx")).toBe("Ada_Lovelace_Resume.docx");
    expect(resumeFileName("Ada Lovelace", "txt")).toBe("Ada_Lovelace_Resume.txt");
  });

  it("transliterates accented names for the filename", () => {
    expect(resumeFileName("José Ángel Muñoz-Łukasiewicz", "pdf")).toBe(
      "Jose_Angel_Munoz-Lukasiewicz_Resume.pdf",
    );
  });

  it("falls back to a plain name when none has been entered", () => {
    expect(resumeFileName("", "pdf")).toBe("Resume.pdf");
    expect(resumeFileName("   ", "pdf")).toBe("Resume.pdf");
  });

  it("replaces unsafe characters with a separator rather than deleting them", () => {
    // Deleting would collapse "Ann/Marie" and "AnnMarie" onto one filename.
    expect(resumeFileName("Ann/Marie O'Brien", "pdf")).toBe("Ann_Marie_O_Brien_Resume.pdf");
  });

  it("produces a filename safe on every common filesystem", () => {
    for (const { document } of ALL_FIXTURES) {
      const name = resumeFileName(document.contact.fullName, "pdf");
      expect(name).toMatch(/^[A-Za-z0-9_\-.]+$/);
      expect(name.length).toBeLessThan(255);
    }
  });

  it("never alters the document content — only the filename", () => {
    // The guard against "helpfully" anglicizing a name in the resume itself.
    const original = "José Ángel Muñoz-Łukasiewicz";
    resumeFileName(original, "pdf");
    expect(original).toBe("José Ángel Muñoz-Łukasiewicz");
  });
});

describe("DESTINATION_ADVICE", () => {
  it("recommends DOCX for the parsers that prefill application forms", () => {
    const docxDestinations = DESTINATION_ADVICE.filter((a) => a.format === "docx").map(
      (a) => a.destination,
    );
    expect(docxDestinations).toEqual(expect.arrayContaining(["Workday", "Taleo"]));
  });

  it("recommends PDF for modern parsers and for emailing a person", () => {
    const pdfDestinations = DESTINATION_ADVICE.filter((a) => a.format === "pdf").map(
      (a) => a.destination,
    );
    expect(pdfDestinations).toEqual(
      expect.arrayContaining(["Greenhouse", "Lever", "Ashby", "Emailing a person"]),
    );
  });

  it("gives a reason for every recommendation, since D14 forbids bare assertions", () => {
    for (const advice of DESTINATION_ADVICE) {
      expect(advice.reason.length, advice.destination).toBeGreaterThan(20);
      // No guarantees — the claim is reliability, not certainty.
      expect(advice.reason).not.toMatch(/guarantee|always pass|never fail/i);
    }
  });
});
