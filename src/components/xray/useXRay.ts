/**
 * Runs extraction and grading for the X-Ray view (M1-T3).
 *
 * Re-parses the PDF the preview just produced. Debounced, and keyed on the
 * bytes rather than the document, so it only runs when there is genuinely a
 * new artifact to read.
 */

"use client";

import { useEffect, useState } from "react";
import {
  extractPdfGeometric,
  extractPdfStreamOrder,
  strategyDisagreements,
  type ExtractedDocument,
} from "@/lib/xray/extract-browser";
import { recoverFields, scoreRecovery, type Scorecard } from "@/lib/xray/scorecard";
import { useResumeStore } from "@/store/resume";

export interface XRayState {
  loading: boolean;
  streamOrder: ExtractedDocument | null;
  geometric: ExtractedDocument | null;
  /** Graded against the document the PDF was generated from. */
  scorecard: Scorecard | null;
  /** Lines where the two strategies read the page differently. */
  disagreements: string[];
  error: string | null;
}

const EMPTY: XRayState = {
  loading: false,
  streamOrder: null,
  geometric: null,
  scorecard: null,
  disagreements: [],
  error: null,
};

export function useXRay(bytes: Uint8Array | null, active: boolean): XRayState {
  const resume = useResumeStore((s) => s.history.present);
  const [state, setState] = useState<XRayState>(EMPTY);

  useEffect(() => {
    // Extraction is not cheap, and nobody is looking at the result while the
    // panel is closed.
    if (!active || !bytes) return;

    let cancelled = false;

    const run = async () => {
      // Flagged inside the async body rather than in the effect itself: the
      // work has genuinely started here, and setting it synchronously in the
      // effect triggers a second render pass for no benefit.
      setState((prev) => ({ ...prev, loading: true }));
      const streamOrder = await extractPdfStreamOrder(bytes);
      const geometric = await extractPdfGeometric(bytes);
      // Graded on the geometric read: it is what a competent parser does, so
      // it is the fairer basis for a score. Where the naive read differs is
      // reported separately rather than folded into the number.
      const scorecard = scoreRecovery(resume, recoverFields(geometric), geometric.strategy);

      if (cancelled) return;
      setState({
        loading: false,
        streamOrder,
        geometric,
        scorecard,
        disagreements: strategyDisagreements(streamOrder, geometric),
        error: null,
      });
    };

    void run().catch((error: unknown) => {
      if (cancelled) return;
      setState({
        ...EMPTY,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [bytes, active, resume]);

  return state;
}
