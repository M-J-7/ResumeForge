/**
 * Keeps a rendered PDF in step with the document being edited (M0-T9).
 *
 * Three rules shape this, all from the plan:
 *
 * 1. **The preview is the artifact** (D2). What is rendered here is the exact
 *    blob the download button hands over, so preview and export cannot drift.
 * 2. **Typing never stutters.** Generation happens in a worker, debounced
 *    ~400ms after the last edit.
 * 3. **Never flash blank.** The previously rendered result stays on screen
 *    while the next one is generated. A preview that clears itself on every
 *    keystroke reads as broken even when it is merely busy.
 *
 * Falls back to rendering on the main thread where a worker cannot be
 * constructed, so the preview degrades in smoothness rather than vanishing.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { renderPdf } from "@/lib/emit/pdf/render";
import { browserFontResolver } from "@/lib/fonts/paths.browser";
import { useResumeStore } from "@/store/resume";
import type { ResumeDocument } from "@/lib/resume/schema";
import type { RenderRequest, RenderResponse } from "./render.worker";

/** Per M0-T9; also the performance budget in §9. */
export const PREVIEW_DEBOUNCE_MS = 400;

export interface PreviewState {
  /** The most recent successful render; null only before the first one. */
  bytes: Uint8Array | null;
  pageCount: number;
  /** True while a newer render is in flight. The old frame stays visible. */
  rendering: boolean;
  error: string | null;
}

function createWorker(): Worker | null {
  try {
    return new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

export function usePdfPreview(): PreviewState {
  const resume = useResumeStore((s) => s.history.present);
  const hydrated = useResumeStore((s) => s.hydrated);

  const [state, setState] = useState<PreviewState>({
    bytes: null,
    pageCount: 0,
    rendering: false,
    error: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  /** Highest request id whose result has been applied, so a slow earlier
   *  render cannot overwrite a newer one that already landed. */
  const appliedId = useRef(0);

  useEffect(() => {
    const worker = createWorker();
    workerRef.current = worker;
    if (!worker) return;

    worker.onmessage = (event: MessageEvent<RenderResponse>) => {
      const data = event.data;
      if (data.requestId <= appliedId.current) return;
      appliedId.current = data.requestId;

      setState((prev) =>
        data.ok
          ? {
              bytes: new Uint8Array(data.bytes),
              pageCount: data.pageCount,
              rendering: false,
              error: null,
            }
          : { ...prev, rendering: false, error: data.error },
      );
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const timer = setTimeout(() => {
      // Flagged here rather than in the effect body: the render has actually
      // started at this point, and marking it earlier would flash "Updating…"
      // on every keystroke of a burst the debounce is there to absorb.
      setState((prev) => ({ ...prev, rendering: true }));

      const id = ++requestId.current;
      const worker = workerRef.current;

      if (worker) {
        const request: RenderRequest = { requestId: id, resume };
        worker.postMessage(request);
        return;
      }

      void renderOnMainThread(resume, id, appliedId, setState);
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [resume, hydrated]);

  return state;
}

async function renderOnMainThread(
  resume: ResumeDocument,
  id: number,
  appliedId: { current: number },
  setState: (updater: (prev: PreviewState) => PreviewState) => void,
): Promise<void> {
  try {
    const { bytes, pageCount } = await renderPdf(resume, { resolveFont: browserFontResolver });
    if (id <= appliedId.current) return;
    appliedId.current = id;
    setState(() => ({ bytes, pageCount, rendering: false, error: null }));
  } catch (error) {
    if (id <= appliedId.current) return;
    appliedId.current = id;
    setState((prev) => ({
      ...prev,
      rendering: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}
