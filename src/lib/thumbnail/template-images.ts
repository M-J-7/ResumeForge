/**
 * The template gallery's pictures, as files.
 *
 * ## Why files, when they used to be rendered in the browser
 *
 * Every card was a real render: the sample resume through `renderPdf`, then
 * pdfjs onto a canvas, two dozen times, in the visitor's browser. That is the
 * right *source* for a picture of a template and the wrong *place* to make
 * it. On a throttled phone `/templates` spent seconds downloading react-pdf
 * before the first card had anything in it, and its largest paint was the
 * last thing on the page to arrive (Lighthouse, 2026-09-30: 46 before any
 * fix, 71 after moving the layout to a worker).
 *
 * So the same pipeline runs once, at authoring time: `pnpm thumbnails:build`
 * renders each template's PDF through the real emitter and has pdfjs in a real
 * Chromium draw page one, exactly as the browser would. The result is still a
 * render and never a mock-up — and it cannot go stale silently, because
 * `template-images.test.ts` re-renders every template's PDF on every test run
 * and fails if its fingerprint no longer matches the one its picture was
 * drawn from. Change the emitter, a preset or the sample resume, and the
 * build says which pictures to regenerate.
 *
 * `fingerprint` is a hash of `pdfContentFingerprint(bytes)`: the canonical
 * form that ignores the two things react-pdf varies run to run (font subset
 * tags and object order) and the one thing that varies machine to machine
 * (how zlib chose to compress), and keeps everything a page is made of. The
 * pin is written on a laptop and checked in CI, so that last part matters.
 */

import manifest from "./template-images.json";

/** PDF points to pixels. A4 comes out 595 wide — sharp at card size on a 2x screen. */
export const TEMPLATE_IMAGE_SCALE = 1;

/** Under `public/`, so the files are served from `/template-images/<id>.webp`. */
export const TEMPLATE_IMAGE_DIR = "template-images";

export interface TemplateImageEntry {
  fingerprint: string;
  width: number;
  height: number;
}

export interface TemplateImageManifest {
  scale: number;
  images: Record<string, TemplateImageEntry>;
}

export interface TemplateImage {
  src: string;
  width: number;
  height: number;
}

/**
 * The picture for a template, or null if none has been generated — which
 * `template-images.test.ts` fails the build over, so null is a state the
 * gallery survives rather than one it ships.
 *
 * The fingerprint rides along as a query string, so a regenerated picture is
 * a new URL rather than a cached old one.
 */
export function templateImage(templateId: string): TemplateImage | null {
  const entry = (manifest as TemplateImageManifest).images[templateId];
  if (!entry) return null;
  return {
    src: `/${TEMPLATE_IMAGE_DIR}/${templateId}.webp?v=${entry.fingerprint.slice(0, 12)}`,
    width: entry.width,
    height: entry.height,
  };
}
