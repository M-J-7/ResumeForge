/**
 * Every template on `/templates` downloads as Word and as PDF, made in the
 * browser by the builder's own emitters — the free file the page's title
 * promises, for the query it is written for.
 *
 * Checked as a visitor would get it: the file arrives, it is named for the
 * template, and it is really what it says it is — a Word package with the
 * sample resume inside, or a PDF.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { SAMPLE_RESUME } from "../src/lib/resume/sample";

test("a template downloads as a Word file with the sample in it", async ({ page }) => {
  await page.goto("/templates");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the Atlas template as a Word file" }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe("Atlas_Resume_Template.docx");
  const files = unzipSync(new Uint8Array(readFileSync((await download.path())!)));
  expect(strFromU8(files["word/document.xml"]!)).toContain(SAMPLE_RESUME.contact.fullName);
});

test("a template downloads as a PDF", async ({ page }) => {
  await page.goto("/templates");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the Harbor template as a PDF" }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe("Harbor_Resume_Template.pdf");
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});
