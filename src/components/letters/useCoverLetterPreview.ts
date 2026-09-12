"use client";

/**
 * A live PDF of the letter being edited (P29-J2).
 *
 * The same three rules as `usePdfPreview`, and for the same reasons: the
 * preview *is* the artifact the download hands over (D2), typing never
 * stutters, and the previous frame stays on screen while the next renders
 * rather than flashing blank.
 *
 * What differs is the worker. The resume preview owns one because a
 * five-page resume with five embedded font subsets is genuinely slow; a
 * cover letter is one page of prose in the same already-registered fonts and
 * renders in a few tens of milliseconds. A second worker would cost a second
 * copy of `@react-pdf/renderer` in its own chunk to save a frame nobody can
 * perceive — so this renders on the main thread behind the same debounce.
 */

import { useEffect, useRef, useState } from "react";
import { renderCoverLetterPdf } from "@/lib/emit/cover-letter";
import { browserFontResolver } from "@/lib/fonts/paths.browser";
import type { CoverLetterDocument } from "@/lib/cover-letter/schema";

export const LETTER_PREVIEW_DEBOUNCE_MS = 400;

export interface LetterPreviewState {
  bytes: Uint8Array | null;
  pageCount: number;
  rendering: boolean;
  error: string | null;
}

const IDLE: LetterPreviewState = { bytes: null, pageCount: 0, rendering: false, error: null };

export function useCoverLetterPreview(letter: CoverLetterDocument | null): LetterPreviewState {
  const [state, setState] = useState<LetterPreviewState>(IDLE);

  /** Highest request whose result has been applied, so a slow earlier render
   *  cannot overwrite a newer one that already landed. */
  const applied = useRef(0);
  const requestId = useRef(0);

  useEffect(() => {
    // No letter, nothing to render. The idle result is *derived* on the way
    // out rather than written into state here — a setState in an effect body
    // costs a second render pass for a value that was already knowable.
    if (!letter) return;

    const timer = setTimeout(() => {
      // Flagged once the render has actually started, so "Updating…" does not
      // flash on every keystroke of a burst the debounce exists to absorb.
      setState((prev) => ({ ...prev, rendering: true }));
      const id = ++requestId.current;

      void renderCoverLetterPdf(letter, { resolveFont: browserFontResolver })
        .then(({ bytes, pageCount }) => {
          if (id <= applied.current) return;
          applied.current = id;
          setState({ bytes, pageCount, rendering: false, error: null });
        })
        .catch((error: unknown) => {
          if (id <= applied.current) return;
          applied.current = id;
          setState((prev) => ({
            ...prev,
            rendering: false,
            error: error instanceof Error ? error.message : String(error),
          }));
        });
    }, LETTER_PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [letter]);

  return letter ? state : IDLE;
}
