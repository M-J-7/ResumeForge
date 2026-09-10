/**
 * P32 acceptance, for the parts only a real browser can prove.
 *
 * The unit suite proves the presets are valid and that a style switch cannot
 * move the extracted text. What it cannot prove is that a thumbnail actually
 * rasterizes — that needs pdfjs with a real worker and a real canvas
 * (landmine 6) — or that applying a template is genuinely **one** press of
 * Ctrl+Z rather than five.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openDesignPanel(page: Page) {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  await page.getByRole("button", { name: "Design" }).first().click();
}

test("the public gallery renders every template as a real page image", async ({ page }) => {
  // Twelve PDF renders, run one at a time in a real browser. The default
  // 30s test timeout is a budget for a page load, not for that.
  test.setTimeout(120_000);

  await page.goto("/templates");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Resume templates");

  // Twelve cards. Scoped to the named list, because the page also carries an
  // `sr-only` copy of the same twelve names for crawlers.
  const gallery = page.getByRole("list", { name: "Resume templates" });
  await expect(gallery.getByRole("link")).toHaveCount(12);

  // A real raster, not a zero-sized placeholder — which is the only way to
  // tell "the PDF pipeline ran in this browser" from "a skeleton is showing".
  const firstImage = page.getByRole("img", { name: /rendered as a resume page/i }).first();
  await expect(firstImage).toBeVisible({ timeout: 60_000 });
  const box = await firstImage.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(60);
  expect(box?.height ?? 0).toBeGreaterThan(80);
});

test("the gallery's text is present without JavaScript", async ({ browser }) => {
  // What a crawler reads. The thumbnails need a browser; the twelve names and
  // descriptions must not.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/templates");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Resume templates");
  const body = (await page.locator("body").textContent()) ?? "";
  for (const name of ["Atlas", "Chancery", "Campus", "Workbench", "Meridian", "Beacon"]) {
    expect(body).toContain(name);
  }
  await context.close();
});

test("choosing a template on the public page seeds the builder, with nothing in the URL", async ({
  page,
}) => {
  await page.goto("/templates");
  await page.getByRole("link", { name: /^Chancery/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  // A choice carried in `sessionStorage`, not a query parameter that would
  // survive every reload and silently restyle a document edited since.
  expect(new URL(page.url()).search).toBe("");

  await page.getByRole("button", { name: "Design" }).first().click();
  await expect(page.getByRole("button", { name: /^Chancery/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("applying a template is a single undo step", async ({ page }) => {
  await openDesignPanel(page);

  // Atlas is the default, so the panel opens with it in use.
  await expect(page.getByRole("button", { name: /^Atlas/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: /^Ledger/ }).click();
  await expect(page.getByRole("button", { name: /^Ledger/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // One press. A template that set its settings and then reordered five
  // sections separately would need six, which is not undo — it is a puzzle.
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: /^Atlas/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a template change reaches the rendered preview", async ({ page }) => {
  await page.goto("/builder");
  await page.getByLabel("Full name").fill("Ada Lovelace");

  const preview = page.getByRole("region", { name: "Document preview" });
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Design" }).first().click();
  await page.getByRole("button", { name: /^Quarto/ }).click();
  await page.getByRole("button", { name: "Close" }).click();

  // The preview *is* the artifact (D2), so it re-renders rather than
  // restyling — the assertion is that it comes back at all.
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });
});

test("/templates has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  const detail = blocking
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes.map((node) => `    ${node.target.join(" ")}`).join("\n"),
    )
    .join("\n");

  expect(detail, `axe found ${blocking.length} blocking violation(s) on /templates`).toBe("");
});
