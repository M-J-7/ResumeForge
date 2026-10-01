/**
 * The measured two-column guide: its table is real HTML a crawler reads
 * without JavaScript, its Dataset markup is on the page, and it passes axe in
 * both themes.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PATH = "/guides/two-column-resume-ats";

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        // Best-effort, as the app's own theme script is.
      }
    },
    ["theme-preference", theme],
  );
}

test("the results table and its Dataset are in the HTML, with scripting off", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(PATH);

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Bullets in one piece" })).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(7);

  const markup = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(markup.some((block) => block.includes('"@type":"Dataset"'))).toBe(true);
  await expect(page).toHaveTitle("Can an ATS read a two-column resume? We measured it");
  await context.close();
});

for (const theme of ["light", "dark"] as const) {
  test(`the measured guide passes axe in the ${theme} theme`, async ({ page }) => {
    await setTheme(page, theme);
    await page.goto(PATH);
    await expect(page.getByRole("table")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious.map((violation) => violation.id)).toEqual([]);
  });
}
