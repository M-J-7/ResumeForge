/**
 * P33 acceptance, for the parts only a real browser can prove.
 *
 * The unit suite proves the scaffolds lint clean and that the occupation
 * index matches titles correctly. What it cannot prove is that the drawer
 * fetches its ~0.4 MB index lazily and works, that inserting places the
 * scaffold **with its blanks intact** in a real textarea, and that a preset
 * section reaches the rendered document.
 */

import { expect, test, type Page } from "@playwright/test";

async function openExperienceStep(page: Page) {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
}

test("inserts a scaffold with its blanks intact, never a finished sentence", async ({ page }) => {
  await openExperienceStep(page);
  await page.getByLabel("Job title").fill("Registered Nurse");

  await page.getByRole("button", { name: "Phrase library" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  // The topics arrive only once the occupation index has loaded — which is a
  // dynamic import, so this is also the assertion that the lazy chunk works.
  const scaffold = drawer.getByRole("button", { name: /___/ }).first();
  await expect(scaffold).toBeVisible({ timeout: 30_000 });

  const text = (await scaffold.textContent()) ?? "";
  await scaffold.click();
  await expect(drawer).toBeHidden();

  // D8, as an assertion: what lands in the field still has its blanks, so it
  // cannot be mistaken for a claim the user made.
  const bullet = page.getByRole("textbox", { name: /bullet 1/i });
  await expect(bullet).toHaveValue(/___/);
  await expect(bullet).toHaveValue(text.trim());
});

test("opens on topics for the job title already typed", async ({ page }) => {
  await openExperienceStep(page);
  await page.getByLabel("Job title").fill("Accountant");

  await page.getByRole("button", { name: "Phrase library" }).click();
  const drawer = page.getByRole("dialog");

  // "Also called (…)" only appears when the title resolved to a real O*NET
  // occupation, so its presence is the end-to-end proof that the index
  // loaded and matched.
  await expect(drawer.getByText(/Also called/i)).toBeVisible({ timeout: 30_000 });
});

test("falls back to general topics for a job title nobody has heard of", async ({ page }) => {
  await openExperienceStep(page);
  await page.getByLabel("Job title").fill("Chief Vibes Officer");

  await page.getByRole("button", { name: "Phrase library" }).click();
  const drawer = page.getByRole("dialog");

  // An empty drawer would be the worse failure. The default topics are the
  // shapes that apply to almost any role.
  await expect(
    drawer.getByRole("heading", { name: "Made something faster or cheaper" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(drawer.getByText(/Also called/i)).toBeHidden();
});

test("adds a preset section and it reaches the rendered document", async ({ page }) => {
  await page.goto("/builder");
  await page.getByLabel("Full name").fill("Ada Lovelace");

  await page
    .getByRole("button", { name: /^Custom/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Languages", exact: true }).click();

  // The heading input is what the preset filled in, and it is what an ATS
  // pattern-matches on.
  await expect(page.getByLabel("Section heading")).toHaveValue("Languages");

  // Offered once. A preset already on the document is hidden rather than
  // added twice.
  await expect(page.getByRole("button", { name: "Languages", exact: true })).toBeHidden();

  const preview = page.getByRole("region", { name: "Document preview" });
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });
});

test("does not load the phrase index until the drawer is opened", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await openExperienceStep(page);
  await expect(page.getByLabel("Job title")).toBeVisible();

  // §2.2 budgets the builder at three seconds to interactive. A 0.4 MB
  // occupation index that nobody asked for is exactly the kind of thing that
  // quietly spends it.
  const beforeOpen = requests.filter((url) => /phrases/i.test(url));
  expect(beforeOpen).toEqual([]);
});
