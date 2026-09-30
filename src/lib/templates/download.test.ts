/**
 * A template downloaded as a file is the builder's own output for that
 * template's sample: named for the template, and — for Word — a real
 * document with the sample in it, in the template's paper size.
 *
 * The PDF half needs a browser (fonts are fetched by URL there), so it is
 * proven in `e2e/template-downloads.spec.ts`.
 */

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/resume/templates";
import { SAMPLE_RESUME } from "@/lib/resume/sample";
import { templateFile, templateFileName } from "./download";

describe("templateFileName", () => {
  it("is the template's name, then what the file is", () => {
    const atlas = TEMPLATES.find((template) => template.id === "atlas")!;
    expect(templateFileName(atlas, "docx")).toBe("Atlas_Resume_Template.docx");
    expect(templateFileName(atlas, "pdf")).toBe("Atlas_Resume_Template.pdf");
  });

  it("is a safe filename for every template", () => {
    for (const template of TEMPLATES) {
      expect(templateFileName(template, "docx"), template.id).toMatch(
        /^[A-Za-z0-9]+(_[A-Za-z0-9]+)*_Resume_Template\.docx$/,
      );
    }
  });
});

describe("templateFile as Word", () => {
  it("is a document holding the sample resume, on the template's paper", async () => {
    for (const id of ["atlas", "harbor"]) {
      const template = TEMPLATES.find((candidate) => candidate.id === id)!;
      const blob = await templateFile(template, "docx");
      const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
      const body = strFromU8(files["word/document.xml"]!);

      expect(body).toContain(SAMPLE_RESUME.contact.fullName);
      // Page width in twentieths of a point: A4 is 11906, US Letter 12240.
      const width = template.settings.pageSize === "LETTER" ? "12240" : "11906";
      expect(body, id).toContain(`w:w="${width}"`);
    }
  });
});
