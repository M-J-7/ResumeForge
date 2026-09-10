/**
 * P35 acceptance, in a browser.
 *
 * The unit suite proves the order function. What only a browser proves is
 * that the answer survives a reload — it lives in `localStorage`, which is
 * the whole reason it is not a field on the document — and that the rail a
 * person actually sees is the reordered one.
 */

import { expect, test, type Page } from "@playwright/test";

/** The rail's buttons, in the order they appear. */
async function railOrder(page: Page): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: /resume sections/i });
  const names = await nav.getByRole("button").allTextContents();
  // The rail's last control is the experience-level chip, not a step.
  return names.filter((name) => !name.startsWith("Experience:"));
}

test("asks once on first open, and the answer reorders the rail", async ({ page }) => {
  await page.goto("/builder");

  const prompt = page.getByRole("region", { name: /how much work experience/i });
  await expect(prompt).toBeVisible();

  await page.getByRole("button", { name: /^No work experience yet/ }).click();
  await expect(prompt).toBeHidden();

  const order = await railOrder(page);
  expect(order.findIndex((n) => n.startsWith("Projects"))).toBeLessThan(
    order.findIndex((n) => n.startsWith("Experience")),
  );
  expect(order.findIndex((n) => n.startsWith("Education"))).toBeLessThan(
    order.findIndex((n) => n.startsWith("Experience")),
  );
  // Contact leads whatever the band: a resume with no way to reach you is
  // the one thing the lint engine calls an error.
  expect(order[0]).toMatch(/^Contact/);
});

test("survives a reload and does not ask again", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: /^No work experience yet/ }).click();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();

  await expect(page.getByRole("region", { name: /how much work experience/i })).toBeHidden();
  const order = await railOrder(page);
  expect(order.findIndex((n) => n.startsWith("Projects"))).toBeLessThan(
    order.findIndex((n) => n.startsWith("Experience")),
  );
});

test("10+ restores the default order", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: /^10\+ years/ }).click();

  const order = await railOrder(page);
  expect(order.findIndex((n) => n.startsWith("Experience"))).toBeLessThan(
    order.findIndex((n) => n.startsWith("Projects")),
  );
});

test("skipping is a real answer: default order, and no second prompt", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: "Skip", exact: true }).first().click();

  await expect(page.getByRole("region", { name: /how much work experience/i })).toBeHidden();
  const order = await railOrder(page);
  expect(order.findIndex((n) => n.startsWith("Experience"))).toBeLessThan(
    order.findIndex((n) => n.startsWith("Projects")),
  );
});

test("shows the fresher band where to find evidence, and only that band", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: /^No work experience yet/ }).click();

  await page
    .getByRole("button", { name: /^Projects/ })
    .first()
    .click();
  const panel = page.getByRole("region", { name: "Where to find evidence" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Hackathons");
  await expect(panel).toContainText("Competitive programming");

  // Change band from the rail's own control; the panel goes.
  await page.getByRole("button", { name: /^Experience:/ }).click();
  await page.getByRole("button", { name: /^10\+ years/ }).click();
  await expect(panel).toBeHidden();
});

test("keeps the locked fresher copy for the band it was written for", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: /^No work experience yet/ }).click();
  await page
    .getByRole("button", { name: /^Projects/ })
    .first()
    .click();

  // The three strings both suites assert verbatim. P35 adds copy; it must
  // never edit these.
  await expect(page.getByText(/how you show capability without a job title/i)).toBeVisible();
  await expect(page.getByText(/hackathon entries/i)).toBeVisible();
  await expect(page.getByText(/campus placement portal/i)).toBeVisible();
});
