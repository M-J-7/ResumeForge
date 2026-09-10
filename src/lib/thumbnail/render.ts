/**
 * Renders a resume's first page to a small PNG data URL, client-side only.
 *
 * Reuses the exact PDF pipeline the builder's own preview uses —
 * `renderPdf` with the browser font resolver, then `pdfjs` to rasterize.
 * Two engines that could each interpret a document slightly differently
 * would defeat the reason a thumbnail is worth showing at all: it needs to
 * actually look like the resume, not like a plausible guess at it.
 *
 * D2 is why this is the only acceptable way to get a thumbnail. Standing up
 * a second, server-side rendering path for dashboard cards would create
 * exactly the two-engines problem D2 exists to rule out, just for a smaller
 * image.
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderPdf } from "@/lib/emit/pdf/render";
import { browserFontResolver } from "@/lib/fonts/paths.browser";
import type { ResumeDocument } from "@/lib/resume/schema";
/**
 * Landmine 6, and this module was quietly relying on somebody else.
 *
 * pdfjs refuses to run in a browser without `GlobalWorkerOptions.workerSrc`
 * and has no default to guess at. This file rasterizes a PDF, so it is one
 * of the files that has to say so itself. Until P32 it did not, and it
 * happened to work only where some *other* module on the page had already
 * imported the worker — which stopped being true the moment the template
 * gallery rendered thumbnails on a route that has no preview on it. The
 * symptom was silent: `renderResumeThumbnail` threw, the caller swallowed
 * it, and every card sat on its skeleton forever.
 */
import "@/lib/pdf/worker";

/** Card thumbnails are small; there is no reason to rasterize at preview resolution. */
const THUMBNAIL_SCALE = 0.4;

export async function renderResumeThumbnail(resume: ResumeDocument): Promise<string> {
  const { bytes } = await renderPdf(resume, { resolveFont: browserFontResolver });

  const task = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    useSystemFonts: false,
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/png");
  } finally {
    // `task.destroy()`, not the document's — matches `PdfCanvas.tsx`'s
    // rasterizer, which found this the same way: `PDFDocumentProxy` has no
    // `destroy` of its own.
    await task.destroy();
  }
}
