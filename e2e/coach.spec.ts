/**
 * P34 acceptance, in a browser.
 *
 * The unit suite proves no coach message could be pasted into a resume. What
 * it cannot prove is that the coach appears on the bullet it is about, that
 * it goes away when the bullet is finished, and — the D12 point — that what
 * the user sees is a count rather than a score.
 */

import { expect, test, type Page } from "@playwright/test";

async function addRoleWithBullet(page: Page, bullet: string) {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByRole("textbox", { name: /bullet 1/i }).fill(bullet);
}

test("asks about a bullet with no result, and says how many things there are", async ({ page }) => {
  await addRoleWithBullet(page, "Rebuilt the ingestion path");

  // A count of what is left, never a score — D12.
  const toggle = page.getByRole("button", { name: /things? to think about/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // "2 things to think about", not "50%". Scoped to the toggle itself — the
  // page has a zoom control reading "100%" that a body-wide assertion would
  // trip over.
  // Not anchored at the end: the button carries an `sr-only` suffix naming
  // which bullet it belongs to, which is the whole reason it is there.
  await expect(toggle).toHaveText(/^\d+ things? to think about\b/);
  await expect(toggle).not.toContainText("%");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const notes = page.getByRole("list", { name: /coach notes/i });
  await expect(notes).toContainText("What changed because you did this?");
  await expect(notes).not.toContainText("%");
});

test("goes quiet once the bullet is finished", async ({ page }) => {
  await addRoleWithBullet(page, "Rebuilt the ingestion path");
  await expect(page.getByRole("button", { name: /things? to think about/i })).toBeVisible();

  await page
    .getByRole("textbox", { name: /bullet 1/i })
    .fill("Cut p99 latency from 1.4s to 210ms by rebuilding the ingestion path in Go.");

  // The coach staying quiet is a real answer, not an absence of one.
  await expect(page.getByRole("button", { name: /things? to think about/i })).toBeHidden();
});

test("says nothing at all about an empty bullet", async ({ page }) => {
  await page.goto("/builder");
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();

  // A blank field already has a hint. Four questions on top of it is noise at
  // the moment somebody is trying to start.
  await expect(page.getByRole("button", { name: /things? to think about/i })).toBeHidden();
});

test("never puts a sentence in front of the user that could be pasted", async ({ page }) => {
  await addRoleWithBullet(page, "Responsible for the billing system");
  await page.getByRole("button", { name: /things? to think about/i }).click();

  // Everything the coach says is a question or names a gap. Nothing it shows
  // is a bullet — which, mechanically, means no digit anywhere in it.
  const notes = page.getByRole("list", { name: /coach notes/i });
  await expect(notes).toContainText("Describes the job rather than your work.");

  const text = (await notes.textContent()) ?? "";
  expect(text).toMatch(/\?/);
  expect(text).not.toMatch(/\d/);
});
