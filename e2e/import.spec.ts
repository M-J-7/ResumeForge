/**
 * P31 acceptance, for the parts only a real browser can prove.
 *
 * The unit suite already round-trips all seven fixtures through both
 * formats. What it cannot show is that the pipeline holds together in a
 * browser: pdfjs needs a worker there and does not under Node (landmine 6),
 * the store's history has to survive a real Ctrl+Z, and — the claim the
 * whole `/check` page rests on — the file has to demonstrably not leave the
 * tab.
 *
 * The fixture is a PDF this app just produced, downloaded to disk and read
 * back in. That is deliberate on two counts: it is the strongest available
 * round-trip, and a third-party resume cannot be committed here for the same
 * copyright reason `QA.md` refuses to commit job postings.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync } from "node:fs";

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

/**
 * Builds a resume, downloads it as a PDF, and returns the path on disk.
 *
 * ## Why it waits for the *old* page canvas to go away
 *
 * "Download PDF" hands over `pdfBytes` — the exact bytes behind the live
 * preview, which is the WYSIWYG guarantee the landing page makes. So the
 * download is only current once the preview is, and waiting for a page image
 * to be *visible* does not establish that: one is already on screen from the
 * contact-only render, so the wait passed instantly and the test downloaded
 * the document as it stood **before** the role was added. That is why the
 * import assertions saw a name, an email and a phone number and no
 * "Research Associate" — the PDF genuinely did not contain one.
 *
 * `PdfCanvas` paints by building fresh `<canvas>` elements and calling
 * `replaceChildren`, and only ever after a rasterize resolves. So the
 * disappearance of the specific element captured here is an exact signal
 * that a later render has completed and the bytes behind the button are the
 * new ones. It is a fact about the DOM rather than a guess about timing,
 * which is what a fixed wait here would have been.
 */
async function buildAndDownloadPdf(page: Page): Promise<string> {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();

  await fillContact(page, "Rosalind Franklin", "rosalind@example.com");
  await page.getByLabel("Phone").fill("+44 20 7946 0958");

  const preview = page.getByRole("region", { name: "Document preview" });
  const firstPage = preview.getByRole("img", { name: "Resume page 1" });
  await expect(firstPage).toBeVisible({ timeout: 30_000 });
  // The canvas showing the contact-only document, held so the role added
  // below can be observed to have replaced it.
  const stalePage = await firstPage.elementHandle();

  await addRole(
    page,
    "Research Associate",
    "Birkbeck College",
    "Produced Photo 51, resolving the structure of DNA.",
  );

  await expect
    .poll(() => stalePage?.evaluate((element) => element.isConnected) ?? false, {
      timeout: 30_000,
    })
    .toBe(false);
  // And nothing further is in flight, so the bytes cannot change between
  // this line and the click below.
  await expect(page.getByText("Updating…")).toBeHidden({ timeout: 30_000 });
  await expect(firstPage).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadPromise;

  const saved = path.join(tmpdir(), `e2e-import-${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(saved);
  return saved;
}

test("imports a PDF resume, and Ctrl+Z puts the previous draft back", async ({ page }) => {
  const pdf = await buildAndDownloadPdf(page);

  // A different draft is typed over the top, so anything that comes back
  // came out of the file rather than having survived in storage.
  await page
    .getByRole("button", { name: /^Contact/ })
    .first()
    .click();
  await fillContact(page, "Someone Else", "someone@example.com");
  await expect(page.getByLabel("Full name")).toHaveValue("Someone Else");

  await page.locator('input[type="file"]').setInputFiles(pdf);

  // The review is the point: import never lands silently.
  const review = page.getByRole("dialog");
  await expect(review).toBeVisible({ timeout: 30_000 });
  await expect(review).toContainText("Rosalind Franklin");
  await expect(review).toContainText("rosalind@example.com");
  await expect(review).toContainText("Research Associate");
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await expect(page.getByLabel("Full name")).toHaveValue("Rosalind Franklin");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("rosalind@example.com");

  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await expect(page.getByLabel("Job title")).toHaveValue(/Research Associate/);
  await expect(page.getByLabel("Organization")).toHaveValue(/Birkbeck College/);

  // Replacing the whole document is undoable rather than confirmed — the
  // guarantee `ImportResumeFile` is built around.
  await page.keyboard.press("Control+z");
  await page
    .getByRole("button", { name: /^Contact/ })
    .first()
    .click();
  await expect(page.getByLabel("Full name")).toHaveValue("Someone Else");
});

test("/check reads a resume without sending it anywhere", async ({ page }) => {
  const pdf = await buildAndDownloadPdf(page);

  await page.goto("/check");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("what a machine reads");

  // Every request the page makes from here on, with its body. The claim on
  // the page is that the file never leaves the browser, so this is the
  // assertion that makes it a fact rather than a slogan.
  const bodies: string[] = [];
  const urls: string[] = [];
  page.on("request", (request) => {
    urls.push(request.url());
    const body = request.postData();
    if (body) bodies.push(body);
  });

  await page.getByRole("button", { name: "Choose a file" }).click();
  await page.locator('input[type="file"]').setInputFiles(pdf);

  await expect(page.getByText("What a parser recovered from")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("table")).toContainText("Rosalind Franklin");
  await expect(page.getByRole("table")).toContainText("rosalind@example.com");

  // Nothing carried the resume's content, and nothing left this origin.
  for (const body of bodies) {
    expect(body).not.toContain("Rosalind Franklin");
    expect(body).not.toContain("rosalind@example.com");
    expect(body).not.toContain("Birkbeck");
  }
  for (const url of urls) {
    expect(url.startsWith("http://localhost:3000/") || url.startsWith("blob:")).toBe(true);
    expect(url).not.toContain("Rosalind");
  }
});

test("hands the parsed resume to the builder without putting it in a URL", async ({ page }) => {
  const pdf = await buildAndDownloadPdf(page);

  await page.goto("/check");
  await page.locator('input[type="file"]').setInputFiles(pdf);
  await expect(page.getByText("What a parser recovered from")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Fix this in the builder" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  // A resume in a query string lands in history, in the referrer, and in the
  // server's access log. `sessionStorage` is scoped to the tab and never sent.
  expect(new URL(page.url()).search).toBe("");
  await expect(page.getByLabel("Full name")).toHaveValue("Rosalind Franklin");
});

test("says what to do when a file cannot be read at all", async ({ page }) => {
  await page.goto("/check");

  const broken = path.join(tmpdir(), `e2e-not-a-resume-${Date.now()}.pdf`);
  writeFileSync(broken, "not a pdf at all");

  await page.locator('input[type="file"]').setInputFiles(broken);

  // Matched by its text rather than by `role="alert"`: Next's route
  // announcer carries that role on every page, so the role alone is
  // ambiguous (landmine 17). The assertion is also that the message is the
  // one written for a person, not pdfjs's "Invalid PDF structure".
  await expect(page.getByText(/could not be read as a PDF/i)).toBeVisible({ timeout: 30_000 });
});

test("/check has no serious or critical accessibility violations", async ({ page }) => {
  // The same bar `a11y.spec.ts` holds every other public route to, applied
  // to the new one here rather than by editing that file.
  await page.goto("/check");
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

  expect(detail, `axe found ${blocking.length} blocking violation(s) on /check`).toBe("");
});
