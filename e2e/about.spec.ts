/**
 * `/about` is a content page like the changelog: linked from every footer,
 * complete without JavaScript, and clean under axe.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("about is linked from the footer, reads without JavaScript, and passes axe", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Six Seconds Resume");

  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious.map((violation) => violation.id)).toEqual([]);

  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto("/about");
  await expect(plain.getByRole("heading", { name: "The rules every page follows" })).toBeVisible();
  await expect(plain.getByText("No promised outcomes")).toBeVisible();
  await context.close();
});
