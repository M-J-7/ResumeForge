/**
 * Points pdfjs at its worker script.
 *
 * In a browser pdfjs refuses to run without one and has no sensible default
 * to guess. Under Node it falls back to a fake worker on its own, so this is
 * set only where a real `window` exists.
 *
 * The file is copied into `public/` by `scripts/sync-public-fonts.mjs`
 * alongside the fonts, so it is served from a stable path rather than
 * depending on how a given bundler chooses to emit worker assets.
 *
 * ## Why this is its own module
 *
 * It used to be a side effect at the top of `lib/pdf/read.ts`, which meant
 * anything that rasterized a PDF worked only if something *else* in the same
 * page had imported the text extractor. That held by luck for as long as
 * `PdfCanvas` was only ever mounted beside `PreviewPane`, and broke the
 * moment the cover letter editor rendered a canvas on a route that has no
 * reason to read text back out: pdfjs threw `No "GlobalWorkerOptions.workerSrc"
 * specified` and the preview stayed blank.
 *
 * A module whose whole job is this one assignment can be imported by every
 * file that needs it, and the dependency is then visible in the import list
 * rather than implied by page composition.
 */

import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

export const PDF_WORKER_URL = "/pdf.worker.min.mjs";

if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
}
