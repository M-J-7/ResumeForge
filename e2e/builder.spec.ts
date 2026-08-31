/**
 * End-to-end coverage for the three things only a real browser can prove.
 *
 * 1. The PDF actually generates — in a Web Worker, with fonts fetched over
 *    HTTP — and rasterizes onto a canvas (M0-T9).
 * 2. A hard reload restores the draft from IndexedDB (M0-T7's acceptance
 *    criterion, which a memory backend can only approximate).
 * 3. Downloads produce real files with the right names (M0-T12).
 */

import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { tmpdir } from "node:os";

async function fillContact(page: Page, name: string, email: string) {
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
}

async function addRole(page: Page, title: string, org: string, bullet: string) {
  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByLabel("Job title").fill(title);
  await page.getByLabel("Organization").fill(org);
  await page.getByRole("textbox", { name: /bullet 1/i }).fill(bullet);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
});

test("renders a live PDF preview with real page chrome", async ({ page }) => {
  await fillContact(page, "Ada Lovelace", "ada@example.com");
  await addRole(
    page,
    "Analytical Engine Programmer",
    "Difference Engine Co",
    "Wrote the first algorithm.",
  );

  const preview = page.getByRole("region", { name: "Document preview" });

  // The canvas only exists once the worker has produced a PDF and pdfjs has
  // painted it — so its presence proves the whole pipeline ran.
  const pageCanvas = preview.getByRole("img", { name: "Resume page 1" });
  await expect(pageCanvas).toBeVisible({ timeout: 30_000 });

  // A real, non-zero raster rather than a zero-sized placeholder.
  const box = await pageCanvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);

  await expect(preview.getByText(/pages/)).toBeVisible();
});

test("keeps the previous frame visible while re-rendering", async ({ page }) => {
  await fillContact(page, "Ada Lovelace", "ada@example.com");
  const preview = page.getByRole("region", { name: "Document preview" });
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });

  // Typing triggers a re-render; the old page must not disappear meanwhile.
  await page.getByLabel("Location").fill("London, England");
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible();
});

test("restores the draft from IndexedDB after a hard reload", async ({ page }) => {
  await fillContact(page, "Grace Hopper", "grace@example.com");
  await addRole(page, "Rear Admiral", "US Navy", "Invented the compiler.");

  // Autosave is debounced at 500ms; wait past it so the write has landed in
  // IndexedDB rather than still sitting in memory.
  await page.waitForTimeout(1200);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Grace Hopper");

  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await expect(page.getByLabel("Job title")).toHaveValue("Rear Admiral");
});

test("downloads all three formats with the transliterated filename", async ({ page }) => {
  await fillContact(page, "José Ángel Muñoz-Łukasiewicz", "jose@example.com");
  const preview = page.getByRole("region", { name: "Document preview" });
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });

  for (const [button, expected] of [
    ["Download PDF", "Jose_Angel_Munoz-Lukasiewicz_Resume.pdf"],
    ["Download DOCX", "Jose_Angel_Munoz-Lukasiewicz_Resume.docx"],
    ["Download TXT", "Jose_Angel_Munoz-Lukasiewicz_Resume.txt"],
  ] as const) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: button }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(expected);
  }
});

test("builds a resume with the keyboard alone", async ({ page }) => {
  // The acceptance criterion is not "has shortcuts" but "never needs a mouse".
  await page.getByLabel("Full name").focus();
  await page.keyboard.type("Katherine Johnson");

  await page.keyboard.press("Control+k");
  await page.keyboard.type("Experience");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Experience" })).toBeVisible();

  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByRole("textbox", { name: /bullet 1/i }).focus();
  await page.keyboard.type("Calculated trajectories for Mercury and Apollo.");
  await page.keyboard.press("Control+Enter");

  const second = page.getByRole("textbox", { name: /bullet 2/i });
  await expect(second).toBeFocused();
  await page.keyboard.type("Verified the electronic computer's output by hand.");
  await expect(second).toHaveValue("Verified the electronic computer's output by hand.");
});

test("offers a page-fit suggestion only when the overflow is small", async ({ page }) => {
  await fillContact(page, "Ada Lovelace", "ada@example.com");
  const preview = page.getByRole("region", { name: "Document preview" });
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });

  // A one-page resume must not be nagged about fitting on one page.
  await expect(preview.getByText(/lines? onto page/)).toHaveCount(0);
});

test("X-Ray shows what a parser reads back from the generated PDF", async ({ page }) => {
  await fillContact(page, "Ada Lovelace", "ada@example.com");
  await addRole(
    page,
    "Analytical Engine Programmer",
    "Difference Engine Co",
    "Wrote the first algorithm.",
  );

  const preview = page.getByRole("region", { name: "Document preview" });
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });

  await preview.getByRole("tab", { name: "X-Ray" }).click();

  // The scorecard only exists if the PDF was re-parsed in the browser —
  // pdfjs extraction, not just rendering.
  await expect(preview.getByRole("table")).toBeVisible({ timeout: 30_000 });
  await expect(preview.getByText(/of your fields were recovered/)).toBeVisible();

  // Ground truth we typed must appear as what the machine read.
  await expect(
    preview.getByRole("cell", { name: "Ada Lovelace", exact: true }).first(),
  ).toBeVisible();

  // A clean document must grade at 100% — if it does not, the failure is in
  // our emitters, which is the whole premise of the scorecard.
  const scorecard = preview.locator("section[aria-label='Field recovery scorecard']");
  await expect(scorecard).toContainText("100%");
  await expect(scorecard).not.toContainText("Not found");

  // Layer 1: the extracted text itself.
  await expect(
    preview.getByText("Analytical Engine Programmer", { exact: false }).first(),
  ).toBeVisible();
});

test("exports a JSON Resume file and reads it back (M2-T6)", async ({ page }) => {
  // M2-T6's acceptance is "export re-imports cleanly". The unit tests prove
  // the mapping; this proves the two ends actually meet in a browser — the
  // download, the file on disk, and the file input that reads it.
  await fillContact(page, "Katherine Johnson", "katherine@example.com");
  await addRole(page, "Aerospace Technologist", "NASA", "Calculated launch windows by hand.");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON Resume" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Katherine_Johnson_Resume.json");

  const saved = path.join(tmpdir(), `e2e-${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(saved);

  // Wipe the draft entirely, so nothing that comes back could have survived
  // locally rather than been read out of the file.
  await page.getByRole("button", { name: "Clear all data" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  // `addRole` left the Experience step open; the contact fields are only on
  // screen once we navigate back to them.
  await page
    .getByRole("button", { name: /^Contact/ })
    .first()
    .click();
  await expect(page.getByLabel("Full name")).toHaveValue("");

  await page.locator('input[type="file"]').setInputFiles(saved);
  await expect(page.getByLabel("Full name")).toHaveValue("Katherine Johnson");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("katherine@example.com");

  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await expect(page.getByLabel("Job title")).toHaveValue("Aerospace Technologist");
  await expect(page.getByLabel("Organization")).toHaveValue("NASA");
  await expect(page.getByRole("textbox", { name: /bullet 1/i })).toHaveValue(
    "Calculated launch windows by hand.",
  );
});

test("serves the security headers a production deployment needs", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  // A CSP that is present but wrong is worse than none: it looks like a
  // control and is not one. These are the directives the product depends on.
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  // The PDF is generated in a worker and painted from a blob.
  expect(csp).toContain("worker-src 'self' blob:");
  // No telemetry endpoint exists, and this is what makes that structural.
  expect(csp).toContain("connect-src 'self'");
  // `'wasm-unsafe-eval'` is present and is a different, much narrower thing:
  // it lets react-pdf compile its layout engine and still blocks `eval` of
  // JavaScript. A substring check would confuse the two.
  expect(csp).toContain("'wasm-unsafe-eval'");
  expect(csp).not.toMatch(/(^|\s)'unsafe-eval'/);

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("reports its own health by touching the database", async ({ request }) => {
  // A container serving a perfect landing page over a database it cannot
  // open is exactly the state a healthcheck exists to catch.
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("loads the builder with no console errors under the CSP", async ({ page }) => {
  // The CSP is the one change that can break the product silently: a blocked
  // worker or font shows up as a violation in the console and an empty
  // preview, not as a failed request.
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") violations.push(message.text());
  });

  await page.goto("/builder");
  await page.getByLabel("Full name").fill("Ada Lovelace");
  const preview = page.getByRole("region", { name: "Document preview" });
  await expect(preview.getByRole("img", { name: "Resume page 1" })).toBeVisible({
    timeout: 30_000,
  });

  expect(violations.filter((text) => /Content Security Policy|Refused to/i.test(text))).toEqual([]);
});
