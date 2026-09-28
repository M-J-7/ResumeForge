/**
 * The public bullet checker (ROADMAP Phase 3).
 *
 * Its two promises are the ones `/check` makes about a file, applied to
 * pasted text: it works entirely in this tab, and what you type is not sent
 * anywhere. The second is asserted the way `import.spec.ts` asserts it — by
 * watching every request the page makes while it is used.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PATH = "/bullet-point-checker";
/** Distinctive enough that finding it in a request cannot be a coincidence. */
const BULLET = "Responsible for the Zanzibar quarterly reconciliation pack";

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

test("checks a pasted bullet in the page, and sends it nowhere", async ({ page }) => {
  const carried: string[] = [];
  page.on("request", (request) => {
    const body = request.postData() ?? "";
    if (request.url().includes("Zanzibar") || body.includes("Zanzibar")) {
      carried.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto(PATH);
  await page.getByLabel("Your bullets, one per line").fill(BULLET);

  const results = page.getByRole("list", { name: "Results" });
  await expect(results.getByText(BULLET)).toBeVisible();
  // The coach's question for a duty phrase, and the parts it lacks, spelled out.
  await expect(results.getByText("What did you actually do?")).toBeVisible();
  await expect(results.getByText("No outcome")).toBeVisible();
  await expect(page.getByText("1 bullet checked.")).toBeVisible();

  // Give any request that was going to happen time to be made, then check.
  await page.waitForLoadState("networkidle");
  expect(carried, "a request carried the pasted bullet").toEqual([]);
});

test("stays quiet about a bullet with all four parts", async ({ page }) => {
  await page.goto(PATH);
  await page
    .getByLabel("Your bullets, one per line")
    .fill("Cut invoice processing from 5 days to 1 by automating matching with a rules engine");
  await expect(page.getByText("Nothing to ask about this one.", { exact: false })).toBeVisible();
});

test("explains itself without JavaScript, and is in the sitemap", async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(PATH);
  expect(response?.status()).toBe(200);
  const text = (await page.locator("body").textContent()) ?? "";
  await context.close();

  expect(text).toContain("What it checks");
  expect(text).toContain("What it will not do");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`${PATH}</loc>`);
});

for (const theme of ["light", "dark"] as const) {
  test(`has no serious accessibility violations with results showing, ${theme} theme`, async ({
    page,
  }) => {
    await setTheme(page, theme);
    await page.goto(PATH);
    await page.getByRole("button", { name: "Try three examples" }).click();
    await expect(page.getByText("3 bullets checked.")).toBeVisible();

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
    expect(detail, `axe found ${blocking.length} blocking violation(s)`).toBe("");
  });
}
