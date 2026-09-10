"use client";

/**
 * A template rendered as the document it actually produces (P32-B3).
 *
 * ## It is a real render, not a picture of one
 *
 * `renderResumeThumbnail` runs the same `renderPdf` the preview and the
 * download run, against a sample resume with the template's settings
 * applied, and rasterizes page one. So the gallery cannot drift from the
 * output: there is no separate mock-up asset to forget to update when a
 * heading style changes, and nothing here can promise a layout the emitter
 * would not produce.
 *
 * That is D2 applied to marketing rather than to the builder, and it is the
 * same argument: two engines that could disagree is the failure, not the
 * cost of avoiding it.
 *
 * ## Client-side, always
 *
 * Never render a resume server-side. Rendering twelve of them per request
 * would be worse still. So this mounts, renders in the browser, and caches
 * the result — keyed by the template id, since a template's appearance
 * changes only when the code does.
 *
 * ## Rendered one at a time
 *
 * Twelve concurrent `renderPdf` calls contend for one Yoga WASM instance and
 * make the gallery slower than doing them in sequence, while also spiking
 * memory. `useTemplateThumbnails` runs them serially and paints each as it
 * arrives, so the page fills in progressively instead of stalling and then
 * appearing all at once.
 */

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { readCachedThumbnail, writeCachedThumbnail } from "@/lib/thumbnail/cache";
import { renderResumeThumbnail } from "@/lib/thumbnail/render";
import type { TemplateDefinition } from "@/lib/resume/templates";
import type { ResumeDocument } from "@/lib/resume/schema";

/**
 * Cache key. Bumped by hand when the emitters change what a template looks
 * like — the same reason `thumbnailKey` takes `updatedAt` for a resume. A
 * template has no `updatedAt`, so the version stands in for one.
 */
const THUMBNAIL_VERSION = "v1";

function cacheKey(templateId: string): string {
  return `template:${THUMBNAIL_VERSION}:${templateId}`;
}

/**
 * Renders each template in turn, returning what has arrived so far.
 *
 * Serial by construction — see the module docblock. The `cancelled` flag is
 * checked after every await so navigating away mid-run stops the queue
 * rather than finishing twelve renders nobody is waiting for.
 *
 * Both arguments must be **stable references** — module constants, which is
 * what every caller passes. A fresh object literal per render would put a
 * new identity in the dependency list and restart twelve PDF renders on
 * every paint.
 */
export function useTemplateThumbnails(
  templates: readonly TemplateDefinition[],
  sample: ResumeDocument,
): Record<string, string> {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      for (const template of templates) {
        if (cancelled) return;
        const key = cacheKey(template.id);

        const cached = await readCachedThumbnail(key);
        if (cancelled) return;
        if (cached) {
          setThumbnails((prev) => ({ ...prev, [template.id]: cached }));
          continue;
        }

        try {
          const dataUrl = await renderResumeThumbnail({
            ...sample,
            settings: template.settings,
            sections: orderSections(sample, template),
          });
          if (cancelled) return;
          setThumbnails((prev) => ({ ...prev, [template.id]: dataUrl }));
          await writeCachedThumbnail(key, dataUrl);
        } catch {
          // A thumbnail that will not render is a missing picture, not a
          // broken page. The card falls back to its name and description,
          // which is the information that actually decides the choice.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [templates, sample]);

  return thumbnails;
}

/** The template's order, with anything it does not name kept after it. */
function orderSections(sample: ResumeDocument, template: TemplateDefinition) {
  const rank = new Map(template.sectionOrder.map((type, index) => [type, index]));
  return [...sample.sections].sort(
    (a, b) =>
      (rank.get(a.type) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.type) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function TemplateThumbnail({
  template,
  src,
  className,
}: {
  template: TemplateDefinition;
  src: string | undefined;
  className?: string;
}) {
  if (!src) {
    return <Skeleton className={className ?? "aspect-[1/1.414] w-full rounded-md"} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- a data: URL rasterized in this browser, not an optimizable remote asset
    <img
      src={src}
      alt={`The ${template.name} template, rendered as a resume page`}
      className={className ?? "aspect-[1/1.414] w-full rounded-md object-cover object-top"}
      loading="lazy"
    />
  );
}
