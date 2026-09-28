/**
 * The responsive, reduced-motion and no-JavaScript sweep.
 *
 * Three things no committed suite covers, and all three are the kind of thing
 * a person "checks" by looking at two pages and declaring it fine:
 *
 *   1. **Horizontal overflow** at every breakpoint on every route, in both
 *      themes. Names the widest offending element rather than reporting a
 *      number, because "1447 > 1440" tells you nothing about what to fix.
 *   2. **`prefers-reduced-motion` delivers the finished page**, not a fast
 *      version of the animated one. Asserts no `[data-build]` element is still
 *      clipped, translated, blurred or faded once the page has settled.
 *   3. **The marketing routes render their text with scripting off.** The
 *      committed `e2e/content.spec.ts` covers `/examples`, `/guides` and
 *      `/templates`; this covers the rest, which matters because every reveal
 *      is an inline style Motion writes during *server* rendering and only the
 *      `<noscript>` rule in `layout.tsx` removes it.
 *
 * Needs a server already running — `pnpm build && pnpm start` — because it is
 * a check on the production build rather than on the dev server's output.
 *
 *   pnpm qa:sweep
 */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const ROUTES = [
  "/",
  "/pricing",
  "/templates",
  "/check",
  "/examples",
  "/examples/registered-nurse",
  "/guides",
  "/guides/what-an-ats-actually-does",
  "/privacy",
  "/terms",
  "/signin",
  "/builder",
  "/nope",
];
const WIDTHS = [390, 768, 1024, 1440];

const browser = await chromium.launch();
let failures = 0;

async function context(options = {}) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(
    ([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
    ["theme-preference", options.theme ?? "dark"],
  );
  return ctx;
}

console.log("=== 1. horizontal overflow ===");
for (const theme of ["light", "dark"]) {
  for (const width of WIDTHS) {
    const ctx = await context({ viewport: { width, height: 900 }, theme });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(250);
      const over = await page.evaluate(() => {
        const doc = document.documentElement;
        if (doc.scrollWidth <= doc.clientWidth) return null;
        // Name the widest offender, so the report is actionable.
        let worst = null;
        for (const el of document.querySelectorAll("body *")) {
          const box = el.getBoundingClientRect();
          if (box.right > doc.clientWidth + 1 && (!worst || box.right > worst.right)) {
            worst = {
              right: Math.round(box.right),
              tag: el.tagName.toLowerCase(),
              cls: String(el.className).slice(0, 90),
            };
          }
        }
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, worst };
      });
      if (over) {
        failures++;
        console.log(
          `  OVERFLOW ${theme} ${width} ${route}: ${over.scrollWidth} > ${over.clientWidth}`,
          JSON.stringify(over.worst),
        );
      }
    }
    await ctx.close();
  }
}
console.log(failures === 0 ? "  none" : `  ${failures} overflow(s)`);

console.log("\n=== 2. reduced motion delivers the finished page ===");
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(
    ([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
    ["theme-preference", "dark"],
  );
  const page = await ctx.newPage();
  for (const route of ["/", "/pricing", "/examples/registered-nurse"]) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const report = await page.evaluate(() => {
      const built = [...document.querySelectorAll("[data-build]")];
      const hidden = built.filter((el) => {
        const s = getComputedStyle(el);
        return (
          s.clipPath !== "none" ||
          Number(s.opacity) < 0.99 ||
          (s.transform !== "none" && s.transform !== "matrix(1, 0, 0, 1, 0, 0)") ||
          s.filter !== "none"
        );
      });
      const h1 = document.querySelector("h1");
      return {
        built: built.length,
        stillHidden: hidden.map((el) => el.tagName + "." + String(el.className).slice(0, 50)),
        h1Height: h1 ? Math.round(h1.getBoundingClientRect().height) : 0,
        sections: document.querySelectorAll("main section").length,
      };
    });
    const bad = report.stillHidden.length > 0;
    if (bad) failures++;
    console.log(
      `  ${route}: ${report.built} built, ${report.stillHidden.length} still hidden,` +
        ` h1 ${report.h1Height}px, ${report.sections} sections` +
        (bad ? " <-- FAIL " + JSON.stringify(report.stillHidden.slice(0, 4)) : ""),
    );
  }
  await ctx.close();
}

console.log("\n=== 3. marketing text with scripting off ===");
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  for (const route of ["/", "/pricing", "/check", "/templates"]) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    const ok = text.length > 900;
    if (!ok) failures++;
    console.log(`  ${route}: ${text.length} visible chars${ok ? "" : " <-- FAIL"}`);
  }
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nSWEEP CLEAN" : `\nSWEEP: ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
