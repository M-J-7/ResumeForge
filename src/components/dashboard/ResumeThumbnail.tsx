"use client";

/**
 * A dashboard card's page-1 preview (P22-E4).
 *
 * ## Rendered on demand, not on load
 *
 * A dashboard with a dozen resumes must not render a dozen PDFs the instant
 * it opens — that is a dozen font loads and a dozen Yoga layout passes for
 * cards the user may never scroll to. `IntersectionObserver` defers each
 * thumbnail until its card is actually visible, and disconnects once it has
 * fired once: a thumbnail does not need to know about further scrolling.
 *
 * ## The one round trip
 *
 * Rendering needs the resume's full `content`, which `listResumes` leaves out
 * of the dashboard's initial query on purpose (see the header of
 * `getResumeContentAction`). This component is the one place that fetches it,
 * and only for a card actually on screen — and even then, only on a cache
 * miss (see `src/lib/thumbnail/cache.ts`).
 */

import { useEffect, useRef, useState } from "react";
import { getResumeContentAction } from "@/app/dashboard/actions";
import { readCachedThumbnail, thumbnailKey, writeCachedThumbnail } from "@/lib/thumbnail/cache";
import { renderResumeThumbnail } from "@/lib/thumbnail/render";
import { cn } from "@/lib/utils";
import { FileTextIcon } from "@/components/ui/icons";

type ThumbnailStatus = "idle" | "loading" | "ready" | "error";

export function ResumeThumbnail({
  resumeId,
  updatedAt,
  className,
}: {
  resumeId: string;
  /** ISO timestamp. Part of the cache key — a newer save invalidates it. */
  updatedAt: string;
  className?: string;
}) {
  const [status, setStatus] = useState<ThumbnailStatus>("idle");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let cancelled = false;

    const render = async () => {
      setStatus("loading");
      const key = thumbnailKey(resumeId, updatedAt);

      const cached = await readCachedThumbnail(key);
      if (cached) {
        if (!cancelled) {
          setDataUrl(cached);
          setStatus("ready");
        }
        return;
      }

      const result = await getResumeContentAction(resumeId);
      if (!result.ok) {
        if (!cancelled) setStatus("error");
        return;
      }

      try {
        const rendered = await renderResumeThumbnail(result.value);
        if (cancelled) return;
        setDataUrl(rendered);
        setStatus("ready");
        void writeCachedThumbnail(key, rendered);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void render();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [resumeId, updatedAt]);

  return (
    <div
      ref={rootRef}
      className={cn(
        // The canvas, not a bordered box. What is inside it is a *page*, and
        // the page is the only thing in the app that gets a real shadow —
        // `design.md` §6. A hairline rectangle around a picture of a resume
        // said "image"; a lit page on a darker ground says "document".
        "bg-canvas relative aspect-[210/297] overflow-hidden rounded-md p-2.5",
        className,
      )}
    >
      {status === "ready" && dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a client-generated data: URL, not an optimizable remote asset
        <img
          src={dataUrl}
          alt=""
          // Decorative: the card's own heading already names the resume: a
          // second description of "a resume" would be pure noise to a screen
          // reader, repeated once per card.
          className="bg-paper ring-paper-edge h-full w-full rounded-[2px] object-contain shadow-[var(--shadow-page)] ring-1"
        />
      ) : status === "error" ? (
        <div className="text-faint flex h-full items-center justify-center">
          <FileTextIcon className="h-8 w-8" />
        </div>
      ) : (
        <div aria-hidden="true" className="anim-shimmer h-full w-full" />
      )}
    </div>
  );
}
