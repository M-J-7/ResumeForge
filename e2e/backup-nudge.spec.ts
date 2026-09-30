/**
 * R2: a guest is told, once there is work to lose, that it lives in this
 * browser alone — and the backup offered is one that actually brings the
 * resume back.
 *
 * The unit suite covers when it shows and how it is put away. This covers
 * what only a browser can: the region passes axe in both themes' default, the
 * file really downloads, and after every trace of the draft is wiped the file
 * restores it through the builder's own import.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";
import { waitForDraftSaved } from "./draft";

const NUDGE = { name: "Keep a copy of this resume" };

async function buildALittle(page: Page) {
  await page.getByLabel("Full name").fill("Dorothy Vaughan");
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByLabel("Job title").fill("Computing Section Head");
  await page.getByLabel("Organization").fill("NACA");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
});

test("says nothing until there is work to lose, then offers a backup that restores it", async ({
  page,
}) => {
  await expect(page.getByRole("heading", NUDGE)).toHaveCount(0);

  await buildALittle(page);
  const region = page.getByRole("region", NUDGE);
  await expect(region).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .include("section[aria-labelledby='backup-nudge-heading']")
    .analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => v.id)).toEqual([]);

  const downloading = page.waitForEvent("download");
  await region.getByRole("button", { name: "Download a backup" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("Dorothy_Vaughan_Resume.json");
  const saved = path.join(tmpdir(), `e2e-${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(saved);

  // Taking the backup is an answer: the reminder goes away.
  await expect(page.getByRole("heading", NUDGE)).toHaveCount(0);

  // The loss it warns about, made real, then undone by the file alone.
  await page.getByRole("button", { name: "Clear all data" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: /^Contact/ })
    .first()
    .click();
  await expect(page.getByLabel("Full name")).toHaveValue("");

  await page.locator('input[type="file"]').setInputFiles(saved);
  await expect(page.getByLabel("Full name")).toHaveValue("Dorothy Vaughan");
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await expect(page.getByLabel("Job title")).toHaveValue("Computing Section Head");
  await expect(page.getByLabel("Organization")).toHaveValue("NACA");
});

test("stays put away across a reload once someone says not now", async ({ page }) => {
  await buildALittle(page);
  await page.getByRole("button", { name: "Remind me in a month" }).click();
  await expect(page.getByRole("heading", NUDGE)).toHaveCount(0);

  // The draft has to be in storage before the reload, or the reload tests an
  // empty form, where the reminder would be absent for the wrong reason.
  await waitForDraftSaved(page, "Computing Section Head");
  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Dorothy Vaughan");
  await expect(page.getByRole("heading", NUDGE)).toHaveCount(0);
});
