/**
 * `/guides/is-any-resume-builder-really-free` — the guide written for the
 * "truly free resume builder" family of searches, held to what
 * `content.spec.ts` holds the first guides to: it is text without
 * JavaScript, it is in the sitemap, its title fits a results page, and axe
 * finds nothing serious on it. That spec lists its guides by hand, so a new
 * one is checked here rather than by editing it.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PATH = "/guides/is-any-resume-builder-really-free";

test("the free-builder guide is text without JavaScript, and in the sitemap", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(PATH);
  const text = (await page.locator("main").textContent()) ?? "";
  await context.close();

  expect(text.split(/\s+/).length).toBeGreaterThan(600);
  expect(text).toContain("A two-minute check before you type anything");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`<loc>http://localhost:3000${PATH}</loc>`);
});

test("the free-builder guide's title fits a results page", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveTitle("Is any resume builder really free? How to check first");
});

test("the free-builder guide has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto(PATH);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(blocking.map((violation) => violation.id)).toEqual([]);
});
