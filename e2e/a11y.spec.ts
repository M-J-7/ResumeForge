/**
 * Automated accessibility checks (P21-D6).
 *
 * §9 requires the builder to be keyboard-navigable end to end and to meet
 * WCAG AA contrast. Until now those guarantees were *structural* — real
 * elements, real labels, hand-written `dark:` pairs — and nothing verified
 * them. That was tolerable while the markup was stable. It stops being
 * tolerable during a redesign, which is exactly when a `text-muted` on a
 * `bg-surface-2` quietly drops to 3.9:1 and nobody notices for a month.
 *
 * ## What this does and does not catch
 *
 * axe finds roughly a third of real accessibility problems: contrast, missing
 * names, broken ARIA relationships, duplicate ids. It cannot tell you the tab
 * order is nonsense or that a control is unreachable. Those stay covered by
 * the role-and-label assertions throughout `builder.spec.ts` and
 * `auth.spec.ts`, which is why this file supplements those rather than
 * replacing anything.
 *
 * ## Both themes, deliberately
 *
 * Contrast is the failure mode a token system introduces, and a dark palette
 * is a second set of colour pairings that nothing else checks. Running each
 * route twice is cheap and is the whole reason `data-theme` is scriptable.
 *
 * ## `/dashboard` is not here yet
 *
 * It is behind authentication, and the only way in is a magic link from the
 * capture server in `mail-server.ts`, which binds a fixed port that
 * `auth.spec.ts` already owns for the length of its run. Two spec files
 * competing for it under `fullyParallel` is a flaky suite, which is a worse
 * outcome than a documented gap. The dashboard is covered by role-and-label
 * assertions in `auth.spec.ts`; it joins this file when P22 redesigns it and
 * a shared sign-in fixture is worth extracting.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Serious and critical only.
 *
 * axe's `minor` and `moderate` findings include judgement calls — landmark
 * nesting preferences, heading-order advice that is wrong as often as it is
 * right. Failing CI on those trains people to add exceptions, and a suppressed
 * check is worth less than no check. These two levels are unambiguous.
 */
const BLOCKING = ["serious", "critical"];

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  // Written before navigation so the first paint of every page under test is
  // already in the theme being checked.
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        // Nothing to do; the init script is best-effort in the same way the
        // app's own theme script is.
      }
    },
    ["theme-preference", theme],
  );
}

async function scan(page: Page, url: string): Promise<void> {
  await page.goto(url);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter((violation) =>
    BLOCKING.includes(violation.impact ?? ""),
  );

  // The message is the failure. A bare count sends whoever broke it back to
  // the browser to find out what; this puts the rule, the impact and the
  // offending selector straight in the CI log.
  const detail = blocking
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes.map((node) => `    ${node.target.join(" ")}`).join("\n"),
    )
    .join("\n");

  expect(detail, `axe found ${blocking.length} blocking violation(s) on ${url}`).toBe("");
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await setTheme(page, theme);
    });

    test("landing page has no serious or critical violations", async ({ page }) => {
      await scan(page, "/");
    });

    test("sign-in page has no serious or critical violations", async ({ page }) => {
      await scan(page, "/signin");
    });

    test("builder has no serious or critical violations", async ({ page }) => {
      await scan(page, "/builder");
      // The preview renders asynchronously in a worker, and its page chrome
      // is built imperatively in `PdfCanvas`. Scanning again once it has
      // painted is the only way that markup is covered at all.
      await expect(page.getByRole("img", { name: "Resume page 1" })).toBeVisible();
      await scan(page, "/builder");
    });

    test("privacy and terms have no serious or critical violations", async ({ page }) => {
      await scan(page, "/privacy");
      await scan(page, "/terms");
    });
  });
}
