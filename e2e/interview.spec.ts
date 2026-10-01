/**
 * The Interview tab (ROADMAP F9, "Defend every number"), in the builder.
 *
 * What it finds is covered sentence by sentence in `claims.test.ts`. This
 * covers what only a browser can: that it follows the document as it is
 * edited, that a tick survives a reload and is undone by an edit to the
 * sentence, and that it passes axe in both themes.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { waitForDraftSaved } from "./draft";

const BULLET = "Cut median deploy time from 38 minutes to 6 by moving 14 services onto one cluster.";

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

async function buildResume(page: Page): Promise<void> {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByLabel("Job title").fill("Platform Engineer");
  await page.getByLabel("Organization").fill("Meridian Health");
  await page.getByRole("textbox", { name: /bullet 1/i }).fill(BULLET);
  await waitForDraftSaved(page, "Cut median deploy time");
}

test("lists each figure with its question, and keeps a tick until the sentence changes", async ({
  page,
}) => {
  await buildResume(page);
  await page.getByRole("tab", { name: "Interview" }).click();

  const group = page.getByRole("region", { name: "Platform Engineer · Meridian Health" });
  await expect(group).toBeVisible();
  // The before-and-after is one mark; the service count is another.
  await expect(group.locator("mark")).toHaveText(["from 38 minutes to 6", "14"]);
  await expect(group).toContainText("What was it before, what was it after");
  await expect(page.getByText("0 of 1 ready")).toBeVisible();

  const tick = group.getByRole("checkbox");
  await tick.check();
  await expect(page.getByText("1 of 1 ready")).toBeVisible();

  // A reload keeps it: the tick is about this sentence, which has not changed.
  await page.reload();
  await page.getByRole("tab", { name: "Interview" }).click();
  await expect(page.getByText("1 of 1 ready")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Platform Engineer · Meridian Health" }).getByRole("checkbox"),
  ).toBeChecked();

  // Changing a figure changes the answer, so the tick comes off.
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: /bullet 1/i })
    .fill(BULLET.replace("to 6", "to 5"));
  await waitForDraftSaved(page, "from 38 minutes to 5");
  await page.getByRole("tab", { name: "Interview" }).click();
  await expect(page.getByText("0 of 1 ready")).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`the Interview tab passes axe in the ${theme} theme`, async ({ page }) => {
    await setTheme(page, theme);
    await buildResume(page);
    await page.getByRole("tab", { name: "Interview" }).click();
    await expect(page.getByText("0 of 1 ready")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious.map((violation) => violation.id)).toEqual([]);
  });
}
