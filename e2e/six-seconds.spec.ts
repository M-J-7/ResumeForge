/**
 * The Six-Second View (ROADMAP F1), in the builder.
 *
 * What it measures is covered on real PDFs by `scan.test.tsx`. This covers
 * the part only a browser can: that the tab reads the preview's own bytes,
 * finds the facts where they landed, says so in a list a screen reader gets,
 * and passes axe in both themes with its overlay drawn.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { waitForDraftSaved } from "./draft";

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
  await page
    .getByRole("textbox", { name: /bullet 1/i })
    .fill("Cut median deploy time from 38 minutes to 6 by moving services onto one cluster.");
  await waitForDraftSaved(page, "Cut median deploy time");
}

test("marks where the name and the current role landed on page one", async ({ page }) => {
  await buildResume(page);
  await page.getByRole("tab", { name: "Six seconds" }).click();

  const facts = page.getByRole("list", { name: "Facts a first read looks for" });
  const name = facts.getByRole("listitem").filter({ hasText: "Your name" });
  const role = facts.getByRole("listitem").filter({ hasText: "Your current role" });

  await expect(name).toContainText("Near the top", { timeout: 30_000 });
  await expect(role).toContainText("Platform Engineer, Meridian Health");
  await expect(role).toContainText("Near the top");
  await expect(page.getByText("Nothing to look at", { exact: false })).toBeVisible();

  // The page itself, drawn from the preview's bytes, with its overlay.
  await expect(
    page.getByRole("img", { name: /Page one of your resume, with the quick-read zone/ }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`the Six seconds tab passes axe in the ${theme} theme`, async ({ page }) => {
    await setTheme(page, theme);
    await buildResume(page);
    await page.getByRole("tab", { name: "Six seconds" }).click();
    await expect(
      page.getByRole("list", { name: "Facts a first read looks for" }).getByText("Your name"),
    ).toBeVisible({ timeout: 30_000 });
    // Axe should judge the drawn picture, not a mark mid-wipe. Polled on the
    // animations themselves rather than slept on — see e2e/draft.ts.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((animation) => {
              const target = (animation.effect as KeyframeEffect | null)?.target;
              return (
                target instanceof Element &&
                /\bsix-/.test(target.className.toString()) &&
                animation.playState !== "finished"
              );
            }).length,
        ),
      )
      .toBe(0);

    const results = await new AxeBuilder({ page })
      .include('[aria-label="Document preview"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(
      blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}
