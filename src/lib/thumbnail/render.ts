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
 *
 * ## Off the main thread, like the preview
 *
 * `renderPdf` lays out every block and subsets every font in JavaScript. The
 * preview has always done that in `render.worker.ts`; thumbnails did it on
 * the main thread, and `/templates` renders two dozen of them on arrival —
 * Lighthouse measured 1.8s of blocked main thread on a throttled phone on
 * 2026-09-30, most of it here. They now go to the same worker, so the layout
 * is the preview's layout run in the preview's place. The main thread keeps
 * only the rasterization, which at thumbnail scale is small.
 *
 * Callers import this module dynamically, so none of it — react-pdf, pdfjs,
 * the fonts — is in a page's first load or in the prefetch of a page that
 * links to one.
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { RenderRequest, RenderResponse } from "@/components/preview/render.worker";
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

/**
 * How long the render worker is kept after its last job. It holds react-pdf
 * and the fonts it has loaded — tens of megabytes — which is worth keeping
 * while a gallery is filling in and not worth keeping for the rest of the
 * visit.
 */
const IDLE_MS = 15_000;

/** `undefined` until first asked for; `null` once it has proved unavailable. */
let worker: Worker | null | undefined;
let nextRequestId = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<
  number,
  { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }
>();

function releaseWhenIdle(): void {
  clearTimeout(idleTimer);
  if (pending.size > 0) return;
  idleTimer = setTimeout(() => {
    worker?.terminate();
    worker = undefined;
  }, IDLE_MS);
}

function renderWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("../../components/preview/render.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    // No `Worker` (jsdom), or construction refused. The main thread renders
    // instead: slower to paint, never missing.
    worker = null;
    return null;
  }

  worker.onmessage = (event: MessageEvent<RenderResponse>) => {
    const data = event.data;
    const job = pending.get(data.requestId);
    if (!job) return;
    pending.delete(data.requestId);
    if (data.ok) job.resolve(new Uint8Array(data.bytes));
    else job.reject(new Error(data.error));
    releaseWhenIdle();
  };

  // A worker that fails to load at all fails every job. Mark it unavailable
  // so the rest go straight to the main thread instead of each timing out.
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    for (const job of pending.values()) job.reject(new Error("The render worker failed"));
    pending.clear();
  };

  return worker;
}

async function pdfBytes(resume: ResumeDocument): Promise<Uint8Array> {
  const available = renderWorker();
  if (available) {
    clearTimeout(idleTimer);
    try {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const requestId = ++nextRequestId;
        pending.set(requestId, { resolve, reject });
        const request: RenderRequest = { requestId, resume };
        available.postMessage(request);
      });
    } catch {
      // Fall through: the same render, on this thread.
    }
  }

  const [{ renderPdf }, { browserFontResolver }] = await Promise.all([
    import("@/lib/emit/pdf/render"),
    import("@/lib/fonts/paths.browser"),
  ]);
  const { bytes } = await renderPdf(resume, { resolveFont: browserFontResolver });
  return bytes;
}

export async function renderResumeThumbnail(resume: ResumeDocument): Promise<string> {
  const bytes = await pdfBytes(resume);

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
