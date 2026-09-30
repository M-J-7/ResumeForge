/**
 * `/changelog` is a content page like the examples and guides: it has to be
 * readable with scripting off — which is how a crawler reads it — reachable
 * from every page's footer, and clean under axe.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { CHANGELOG } from "../src/lib/changelog";

test("the changelog reads without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/changelog");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What changed");
  const body = (await page.locator("main").textContent()) ?? "";
  for (const entry of CHANGELOG) expect(body, entry.title).toContain(entry.title);
  await context.close();
});

test("the changelog is linked from the footer and passes axe", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "What changed" })
    .click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What changed");

  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious.map((violation) => violation.id)).toEqual([]);
});
