/**
 * An example downloaded as a file is the builder's own output for that
 * example: named for the role, and — for Word — a real document with the
 * example's resume in it, on the example's paper.
 *
 * The PDF half needs a browser (fonts are fetched by URL there), so it is
 * proven in `e2e/example-downloads.spec.ts`.
 */

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ROLE_EXAMPLES } from "./roles";
import { exampleFile, exampleFileName } from "./download";

describe("exampleFileName", () => {
  it("is the role, then what the file is", () => {
    expect(exampleFileName("Staff Nurse", "docx")).toBe("Staff_Nurse_Resume_Example.docx");
    expect(exampleFileName("Software Engineer (Fresher)", "pdf")).toBe(
      "Software_Engineer_Fresher_Resume_Example.pdf",
    );
    expect(exampleFileName("B.Com Fresher", "docx")).toBe("B_Com_Fresher_Resume_Example.docx");
  });

  it("is a safe filename for every example", () => {
    for (const example of ROLE_EXAMPLES) {
      expect(exampleFileName(example.role, "docx"), example.slug).toMatch(
        /^[A-Za-z0-9]+(_[A-Za-z0-9]+)*_Resume_Example\.docx$/,
      );
    }
  });
});

describe("exampleFile as Word", () => {
  it("is a document holding the example, on its own paper", async () => {
    for (const slug of ["staff-nurse", "cashier"]) {
      const example = ROLE_EXAMPLES.find((candidate) => candidate.slug === slug)!;
      const blob = await exampleFile(example.resume, "docx");
      const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
      const body = strFromU8(files["word/document.xml"]!);

      expect(body, slug).toContain(example.resume.contact.fullName);
      // Page width in twentieths of a point: A4 is 11906, US Letter 12240.
      const width = example.resume.settings.pageSize === "LETTER" ? "12240" : "11906";
      expect(body, slug).toContain(`w:w="${width}"`);
    }
  });
});
