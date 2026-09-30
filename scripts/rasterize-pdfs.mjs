/**
 * Rasterizes page one of every PDF in a directory to WebP, in a real browser.
 *
 *   node scripts/rasterize-pdfs.mjs <pdf-dir> <out-dir> <scale>
 *
 * Prints `{ "<name>": { "width": …, "height": … } }` on stdout.
 *
 * Called by `template-images.test.ts` in update mode (`pnpm thumbnails:build`),
 * which renders each template's PDF through the real emitter first. This is
 * the second half of the pipeline the gallery used to run in every visitor's
 * browser — pdfjs painting page one onto a canvas — run once here instead, in
 * Playwright's Chromium, with the same pdfjs build the app ships. So the files
 * are what a visitor's browser would have drawn, rather than what some other
 * rasterizer thinks a PDF looks like.
 *
 * Served from a throwaway local HTTP server rather than `file://` or request
 * interception, because pdfjs starts a module worker, and a worker is the one
 * thing both of those handle unreliably.
 */

import { chromium } from "@playwright/test";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const [, , pdfDir, outDir, scaleArg] = process.argv;
if (!pdfDir || !outDir || !scaleArg) {
  console.error("usage: node scripts/rasterize-pdfs.mjs <pdf-dir> <out-dir> <scale>");
  process.exit(2);
}
const scale = Number(scaleArg);
/** WebP quality. Text at this size survives 0.82 cleanly; 0.9 doubles the bytes. */
const QUALITY = 0.82;

const pdfjsBuild = path.resolve("node_modules/pdfjs-dist/legacy/build");

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import * as pdfjs from "/pdf.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
window.rasterize = async (url, scale, quality) => {
  const task = pdfjs.getDocument({ url, useSystemFonts: false });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return { dataUrl: canvas.toDataURL("image/webp", quality), width: canvas.width, height: canvas.height };
  } finally {
    await task.destroy();
  }
};
window.ready = true;
</script>`;

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const send = (type, body) => {
    response.writeHead(200, { "Content-Type": type });
    response.end(body);
  };
  if (url.pathname === "/") return send("text/html", PAGE);
  if (url.pathname === "/pdf.mjs") {
    return send("text/javascript", readFileSync(path.join(pdfjsBuild, "pdf.mjs")));
  }
  if (url.pathname === "/pdf.worker.mjs") {
    return send("text/javascript", readFileSync(path.join(pdfjsBuild, "pdf.worker.mjs")));
  }
  if (url.pathname.startsWith("/pdf/")) {
    const name = path.basename(url.pathname);
    return send("application/pdf", readFileSync(path.join(pdfDir, name)));
  }
  response.writeHead(404);
  response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const results = {};
try {
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => window.ready === true);

  mkdirSync(outDir, { recursive: true });
  for (const file of readdirSync(pdfDir).filter((name) => name.endsWith(".pdf")).sort()) {
    const name = file.slice(0, -".pdf".length);
    const { dataUrl, width, height } = await page.evaluate(
      ([url, s, q]) => window.rasterize(url, s, q),
      [`/pdf/${file}`, scale, QUALITY],
    );
    if (!dataUrl.startsWith("data:image/webp;base64,")) {
      throw new Error(`${file}: the browser did not encode WebP`);
    }
    writeFileSync(path.join(outDir, `${name}.webp`), Buffer.from(dataUrl.split(",")[1], "base64"));
    results[name] = { width, height };
  }
} finally {
  await browser.close();
  server.close();
}

process.stdout.write(JSON.stringify(results));
