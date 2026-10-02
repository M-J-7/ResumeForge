/**
 * Every example page downloads its resume as Word and as PDF, made in the
 * browser by the builder's own emitters — the file a search for a role's
 * resume "format" or "template" is looking for, and what the page's title now
 * promises.
 *
 * Checked as a visitor would get it: the file arrives, it is named for the
 * role, and it is really what it says it is — a Word package with the
 * example's resume inside, or a PDF.
 */

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { ROLE_EXAMPLES } from "../src/lib/examples/roles";

const staffNurse = ROLE_EXAMPLES.find((example) => example.slug === "staff-nurse")!;

test("an example downloads as a Word file with its resume in it", async ({ page }) => {
  await page.goto("/examples/staff-nurse");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download the Staff Nurse resume example as a Word file" })
    .click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe("Staff_Nurse_Resume_Example.docx");
  const files = unzipSync(new Uint8Array(readFileSync((await download.path())!)));
  expect(strFromU8(files["word/document.xml"]!)).toContain(staffNurse.resume.contact.fullName);
});

test("an example downloads as a PDF", async ({ page }) => {
  await page.goto("/examples/cashier");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the Cashier resume example as a PDF" }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe("Cashier_Resume_Example.pdf");
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("an example's search title says what the page gives, within sixty characters", async ({
  page,
}) => {
  await page.goto("/examples/staff-nurse");
  await expect(page).toHaveTitle("Staff Nurse resume format — free Word & PDF");
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description!.length).toBeLessThanOrEqual(160);
});
