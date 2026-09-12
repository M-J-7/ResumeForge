/**
 * Renders the resume PDF off the main thread (M0-T9).
 *
 * Generating the PDF is the expensive step — react-pdf lays out every block
 * and subsets every font in pure JS, which on a mid-range phone is far more
 * than a frame's worth of work. Doing it inline would drop frames on exactly
 * the keystroke that triggered it, so it runs here instead and the main
 * thread only ever paints the result.
 *
 * The worker fetches fonts by URL from `public/fonts/`, the same files Node
 * reads off disk in tests, so the artifact is identical either way.
 */

import { renderPdf } from "@/lib/emit/pdf/render";
import { browserFontResolver } from "@/lib/fonts/paths.browser";
import type { ResumeDocument } from "@/lib/resume/schema";

export interface RenderRequest {
  /** Echoed back so the main thread can discard responses it has outrun. */
  requestId: number;
  resume: ResumeDocument;
}

export type RenderResponse =
  | { requestId: number; ok: true; bytes: ArrayBuffer; pageCount: number }
  | { requestId: number; ok: false; error: string };

/**
 * `self` is typed as a Window under lib.dom, whose `postMessage` has a
 * different signature from a worker's. Naming just the two members this file
 * uses keeps it honest without pulling the whole WebWorker lib in and
 * colliding with lib.dom elsewhere in the project.
 */
declare const self: {
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  postMessage: (message: RenderResponse, transfer?: Transferable[]) => void;
};

self.onmessage = async (event: MessageEvent<RenderRequest>) => {
  const { requestId, resume } = event.data;
  try {
    const { bytes, pageCount } = await renderPdf(resume, { resolveFont: browserFontResolver });
    // Copy into a fresh buffer so it can be transferred rather than cloned;
    // the worker has no further use for it.
    const buffer = bytes.slice().buffer;
    const message: RenderResponse = { requestId, ok: true, bytes: buffer, pageCount };
    self.postMessage(message, [buffer]);
  } catch (error) {
    const message: RenderResponse = {
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
};
