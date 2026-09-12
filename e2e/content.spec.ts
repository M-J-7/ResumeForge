/**
 * P36 acceptance, in a browser.
 *
 * The criterion that carries the package: **every generated route renders
 * its content with no client JavaScript.** These pages exist to be crawled,
 * and a crawler that has to execute a bundle to find the text is a crawler
 * that indexes an empty page. Asserting it with `javaScriptEnabled: false`
 * is the only way to know rather than assume.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser } from "@playwright/test";

const EXAMPLES = [
  "software-developer",
  "registered-nurse",
  "accountant",
  "data-analyst",
  "project-manager",
  "teacher",
  "sales-representative",
  "graduate-no-experience",
];

const GUIDES = [
  "what-an-ats-actually-does",
  "resume-with-no-experience",
  "how-to-quantify-a-bullet",
  "resume-file-format",
];

/** The page's text, fetched with scripting off. */
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

test("every example page renders its content without JavaScript", async ({ browser }) => {
  test.setTimeout(120_000);

  for (const slug of EXAMPLES) {
    const text = await textWithoutJavaScript(browser, `/examples/${slug}`);
    // The resume itself, the reasoning, and the plain text a parser reads —
    // the three things the page is for.
    expect(text, slug).toContain("Why it is written this way");
    expect(text, slug).toContain("What a parser reads from this resume");
    expect(text.length, slug).toBeGreaterThan(2000);
  }
});

test("every guide renders its content without JavaScript", async ({ browser }) => {
  test.setTimeout(120_000);

  for (const slug of GUIDES) {
    const text = await textWithoutJavaScript(browser, `/guides/${slug}`);
    expect(text.split(/\s+/).length, slug).toBeGreaterThan(300);
  }
});

test("the indexes list everything, without JavaScript", async ({ browser }) => {
  const examples = await textWithoutJavaScript(browser, "/examples");
  for (const name of ["Software Developer", "Registered Nurse", "Accountant"]) {
    expect(examples).toContain(name);
  }

  const guides = await textWithoutJavaScript(browser, "/guides");
  expect(guides).toContain("What an applicant tracking system actually does");
});

test("an example's plain text is the resume's real machine-readable output", async ({ page }) => {
  await page.goto("/examples/software-developer");

  const body = (await page.locator("pre").first().textContent()) ?? "";
  // Section headings in caps, dates as month names, no decoration — this is
  // the TXT emitter's output, not a paraphrase of it.
  expect(body).toContain("EXPERIENCE");
  expect(body).toContain("Devika Menon");
  expect(body).toContain("Senior Backend Engineer");
  expect(body).toMatch(/Mar 2022|Apr 2022/);
});

test("the sitemap lists every generated route", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();

  for (const path of ["/", "/check", "/templates", "/examples", "/guides"]) {
    expect(xml, path).toContain(`<loc>http://localhost:3000${path === "/" ? "/" : path}</loc>`);
  }
  for (const slug of EXAMPLES) expect(xml, slug).toContain(`/examples/${slug}`);
  for (const slug of GUIDES) expect(xml, slug).toContain(`/guides/${slug}`);
});

test("an unknown example or guide is a 404, not a blank page", async ({ page }) => {
  const example = await page.goto("/examples/not-a-real-role");
  expect(example?.status()).toBe(404);

  const guide = await page.goto("/guides/not-a-real-guide");
  expect(guide?.status()).toBe(404);
});

test("the content routes have no serious or critical accessibility violations", async ({
  page,
}) => {
  test.setTimeout(120_000);

  for (const url of [
    "/examples",
    "/examples/registered-nurse",
    "/guides",
    `/guides/${GUIDES[0]}`,
  ]) {
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
