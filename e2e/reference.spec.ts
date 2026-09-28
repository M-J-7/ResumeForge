/**
 * The reference pages and the sideways links between content pages
 * (ROADMAP Phases 1.7 and 3).
 *
 * Held to the same bar as `content.spec.ts` holds the examples and guides:
 * everything a crawler needs is in the HTML with scripting off, the sitemap
 * lists it, and axe finds nothing serious — here in both themes, because the
 * breadcrumb and the "Keep reading" cards are new ink on the dark stage band
 * and on the light body below it.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

const VERBS = "/resume-action-verbs";

async function textWithoutJavaScript(browser: Browser, url: string): Promise<string> {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(200);
    return (await page.locator("body").textContent()) ?? "";
  } finally {
    await context.close();
  }
}

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

test("the action-verbs page is complete without JavaScript", async ({ browser }) => {
  const text = await textWithoutJavaScript(browser, VERBS);
  expect(text).toContain("Resume action verbs, grouped by what you did");
  // A group, its verbs, a shape with a blank, and the table of openers.
  expect(text).toContain("Shipped something");
  expect(text).toContain("shipped");
  expect(text).toContain("___");
  expect(text).toContain("Openers to stop using");
  expect(text).toContain("responsible for");
});

test("the action-verbs page is findable: sitemap, guides index and footer", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`${VERBS}</loc>`);

  await page.goto("/guides");
  await expect(
    page.getByRole("link", { name: "Resume action verbs, grouped by what you did" }),
  ).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Action verbs" }),
  ).toBeVisible();
});

test("examples and guides link sideways, in the HTML", async ({ browser }) => {
  const example = await textWithoutJavaScript(browser, "/examples/graduate-no-experience");
  expect(example).toContain("Keep reading");
  // The guide written about this example leads its guides.
  expect(example).toContain("Writing a resume when you have no work experience");

  const guide = await textWithoutJavaScript(browser, "/guides/resume-with-no-experience");
  expect(guide).toContain("Examples that show it");
  expect(guide).toContain("Graduate with no work experience resume example");
});

test("the visible breadcrumb matches the page", async ({ page }) => {
  await page.goto("/examples/registered-nurse");
  const trail = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(trail.getByRole("link", { name: "Examples" })).toHaveAttribute("href", "/examples");
  await expect(trail.getByText("Registered Nurse resume example")).toHaveAttribute(
    "aria-current",
    "page",
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`the new content surfaces pass axe in the ${theme} theme`, async ({ page }) => {
    test.setTimeout(120_000);
    await setTheme(page, theme);

    for (const url of [VERBS, "/examples/graduate-no-experience", "/guides/resume-file-format"]) {
      await page.goto(url);
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
      expect(detail, `axe found ${blocking.length} blocking violation(s) on ${url}`).toBe("");
    }
  });
}
