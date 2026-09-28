/**
 * The public keyword scanner (ROADMAP Phase 3).
 *
 * The same three promises as the other free tools: it works in the tab, what
 * you paste goes nowhere, and a crawler can read what it is for. Plus the one
 * this tool adds — the resume can be carried into the builder, through the
 * one-time `sessionStorage` handoff `/check` uses, never a URL.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PATH = "/resume-keyword-scanner";

/** Invented. The unusual company name is how a leak would be spotted. */
const POSTING = [
  "Platform Engineer, Quillhaven",
  "",
  "Requirements",
  "- 3+ years with Python",
  "- Experience running PostgreSQL in production",
  "- Kubernetes",
  "",
  "Benefits",
  "- Remote-first",
].join("\n");

const RESUME = [
  "Asha Varma",
  "asha@example.com | +91 98765 43210 | Pune, India",
  "",
  "EXPERIENCE",
  "Backend Engineer | Brightfold | Jan 2022 – Present",
  "- Cut report generation from 40 minutes to 6 by rewriting the Python pipeline",
  "- Migrated billing to PostgreSQL with zero lost invoices",
  "",
  "SKILLS",
  "Kubernetes, Docker",
].join("\n");

async function compare(page: Page): Promise<void> {
  await page.goto(PATH);
  await page.getByLabel("The job description").fill(POSTING);
  await page.getByLabel("Your resume, as text").fill(RESUME);
  await page.getByRole("button", { name: "Compare" }).click();
  // The vocabulary loads on first use, which is the slow step.
  await expect(page.getByText("Coverage", { exact: true })).toBeVisible({ timeout: 60_000 });
}

test("compares a posting with a resume, and sends neither anywhere", async ({ page }) => {
  const carried: string[] = [];
  page.on("request", (request) => {
    const payload = `${request.url()} ${request.postData() ?? ""}`;
    if (payload.includes("Quillhaven") || payload.includes("Brightfold")) {
      carried.push(`${request.method()} ${request.url()}`);
    }
  });

  await compare(page);
  const report = page.getByRole("region", { name: "Comparison" });
  await expect(report.getByText("Demonstrated").first()).toBeVisible();
  await expect(report.getByText("Listed only").first()).toBeVisible();
  // Python is named only in the *first* bullet. Until 2026-09-28 the importer
  // read a "-"-marked first bullet as the role's meta line and dropped it, and
  // this row said Missing — see `src/lib/import/bullet-markers.test.ts`.
  await expect(report.locator("li", { hasText: "Python" }).first()).toContainText("Demonstrated");

  await page.waitForLoadState("networkidle");
  expect(carried, "a request carried the posting or the resume").toEqual([]);
});

test("says so when the text changed after comparing", async ({ page }) => {
  await compare(page);
  await page.getByLabel("Your resume, as text").fill(`${RESUME}\nAWS`);
  await expect(page.getByText("as it was when you pressed Compare")).toBeVisible();
});

test("carries the resume into the builder without putting it in the URL", async ({ page }) => {
  await compare(page);
  await page.getByRole("link", { name: "Continue in the builder with this resume" }).click();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Varma", { timeout: 30_000 });
});

test("asks for both texts before comparing", async ({ page }) => {
  await page.goto(PATH);
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText("Paste the job description first.")).toBeVisible();
});

test("explains itself without JavaScript, and is in the sitemap", async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  expect((await page.goto(PATH))?.status()).toBe(200);
  const text = (await page.locator("body").textContent()) ?? "";
  await context.close();

  expect(text).toContain("How it reads a posting");
  expect(text).toContain("What this is not");
  expect((await (await request.get("/sitemap.xml")).text()).includes(`${PATH}</loc>`)).toBe(true);
});

test("has no serious accessibility violations with a report showing", async ({ page }) => {
  await compare(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(
    blocking.map(
      (violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(", ")}`,
    ),
  ).toEqual([]);
});
