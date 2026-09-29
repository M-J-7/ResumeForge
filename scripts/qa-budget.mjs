/**
 * The builder's performance budget, measured rather than assumed.
 *
 * `IMPLEMENTATION.md` §2.2 is binding and stricter than the design: interactive
 * under 3s on throttled 4G, the preview re-rendering under 400ms, and no
 * dropped frames while typing. Throttling goes through CDP so the numbers mean
 * something on a machine that is not a mid-range phone.
 *
 * ## What each number is measured from
 *
 * **Interactive** is `goto` to the first field being focusable — not a
 * synthetic metric, the thing the budget is actually about.
 *
 * **Keystroke latency** is the round trip of a single character. Under a 4x CPU
 * slowdown anything under ~50ms is comfortably inside a frame at the throttled
 * rate, which is what "no dropped frames while typing" means.
 *
 * **The render** is measured off the canvas pixels. `PdfCanvas` paints the real
 * PDF onto a `<canvas role="img">`, so hashing a strip of it and waiting for
 * the hash to change cannot pass on a render that never happened — which three
 * earlier attempts at this, watching for a `src` change and then for the
 * toolbar's live region, both did. The 400ms debounce in `usePdfPreview` is
 * subtracted, read from that file rather than retyped: it is a deliberate wait
 * so that typing a word does not queue eight renders, and counting it as
 * latency would be measuring our own patience.
 *
 * Needs a server already running — `pnpm build && pnpm start`.
 *
 *   pnpm qa:budget          # Fast 4G + 4x CPU
 *   CPU=1 pnpm qa:budget    # Fast 4G, no CPU slowdown
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * The edit-to-render clock includes a deliberate wait. `usePdfPreview` holds
 * for `PREVIEW_DEBOUNCE_MS` after the last keystroke so that typing a word
 * does not queue eight renders — so the budget's "preview re-render under
 * 400ms" is about the render, and the debounce has to come off the measured
 * figure rather than be counted as latency. Read from the source so the two
 * cannot drift.
 */
const DEBOUNCE = Number(
  /PREVIEW_DEBOUNCE_MS = (\d+)/.exec(
    readFileSync("src/components/preview/usePdfPreview.ts", "utf8"),
  )[1],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

// Fast 4G, as DevTools defines it, plus a 4x CPU slowdown.
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 70,
  downloadThroughput: (9 * 1024 * 1024) / 8,
  uploadThroughput: (1.5 * 1024 * 1024) / 8,
});
const CPU = Number(process.env.CPU ?? 4);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

const t0 = Date.now();
await page.goto("http://localhost:3000/builder", { waitUntil: "commit" });

const nameField = page.getByLabel("Full name");
await nameField.waitFor({ state: "visible", timeout: 30_000 });
await nameField.click();
const interactive = Date.now() - t0;

// Typing latency: how long the main thread takes to give a keystroke back.
const samples = [];
for (const ch of "Priya Raghunathan".split("")) {
  const s = Date.now();
  await page.keyboard.type(ch, { delay: 0 });
  samples.push(Date.now() - s);
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.floor(samples.length * 0.95)];

// The preview is the claim: it re-renders the real PDF on every edit. Measured
// warm and in steady state — the first render after load includes the worker
// starting and the Yoga wasm module compiling, which is a different number and
// not the one the budget is about.
const canvas = page.getByRole("img", { name: "Resume page 1" });
await canvas.waitFor({ timeout: 60_000 });

/**
 * The preview is a real `<canvas>` that `PdfCanvas` paints the rendered PDF
 * onto, so the honest signal is the pixels: hash a strip of them, make an
 * edit, and wait for the strip to change. No poll interval, no live region,
 * and it cannot pass on a render that never happened.
 */
async function editAndWait(value) {
  const strip = () =>
    page.evaluate(() => {
      const el = document.querySelector('canvas[role="img"]');
      if (!el) return null;
      const ctx = el.getContext("2d");
      // The name sits in the top band of the page.
      const data = ctx.getImageData(0, 0, el.width, Math.min(90, el.height)).data;
      let hash = 0;
      for (let i = 0; i < data.length; i += 97) hash = (hash * 31 + data[i]) | 0;
      return hash;
    });

  const before = await strip();
  const started = Date.now();
  await page.getByLabel("Full name").fill(value);
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('canvas[role="img"]');
      if (!el) return false;
      const ctx = el.getContext("2d");
      const data = ctx.getImageData(0, 0, el.width, Math.min(90, el.height)).data;
      let hash = 0;
      for (let i = 0; i < data.length; i += 97) hash = (hash * 31 + data[i]) | 0;
      return hash !== prev;
    },
    before,
    { timeout: 20_000, polling: "raf" },
  );
  return Date.now() - started;
}

await editAndWait("Warm Up One");
const runs = [];
for (const value of ["Priya Raghunathan", "Priya R Iyer", "Priya Raghunathan Iyer"]) {
  runs.push(await editAndWait(value));
}
runs.sort((a, b) => a - b);
const preview = runs[Math.floor(runs.length / 2)];

console.log(`Fast 4G + ${CPU}x CPU throttle, production build`);
console.log(
  "  interactive (first field focusable):",
  interactive + "ms",
  interactive < 3000 ? "OK (<3000)" : "OVER",
);
console.log("  keystroke latency p95:              ", p95 + "ms", p95 < 50 ? "OK (<50)" : "OVER");
const render = preview - DEBOUNCE;
console.log("  edit -> painted, warm (median of 3):  ", preview + "ms");
console.log(
  `    less the ${DEBOUNCE}ms debounce:           `,
  render + "ms",
  render < 400 ? "OK (<400)" : "OVER",
);
console.log("    runs:", runs.join("ms, ") + "ms");

await browser.close();
