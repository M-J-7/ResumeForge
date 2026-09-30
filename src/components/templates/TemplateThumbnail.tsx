/**
 * A template shown as the document it actually produces (P32-B3).
 *
 * ## It is a real render, not a picture of one
 *
 * Each image is the sample resume with the template's settings applied, run
 * through the same `renderPdf` the preview and the download run and drawn by
 * pdfjs in a real Chromium — so the gallery cannot drift from the output, and
 * nothing here can promise a layout the emitter would not produce. That is D2
 * applied to marketing rather than to the builder.
 *
 * ## Rendered once, not in every visitor's browser
 *
 * It used to happen here, on mount: two dozen PDF layouts and rasterizations
 * per visit, behind a download of react-pdf, which made `/templates` the
 * slowest page on the site and its largest paint the last thing to arrive.
 * The pipeline now runs at authoring time (`pnpm thumbnails:build`), and
 * `template-images.test.ts` re-renders every template's PDF on every test run
 * and fails the build the moment one no longer matches its picture. See
 * `src/lib/thumbnail/template-images.ts`.
 *
 * Which also means the gallery is pictures with scripting off — the first
 * time a crawler has seen what a template looks like.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { templateImage } from "@/lib/thumbnail/template-images";
import type { TemplateDefinition } from "@/lib/resume/templates";
import type { Settings } from "@/lib/resume/schema";

/**
 * The card's aspect ratio, taken from the template's own paper size.
 *
 * A4 is 1:1.414 and US Letter is 1:1.294 — a 9% difference, which sounds
 * ignorable and is not. The image is `object-cover`, so a Letter render in an
 * A4-shaped box gets its left and right edges cropped: the picture that is
 * supposed to prove "this is the document you will get" would be quietly
 * showing a document with its margins shaved off. Both class strings are
 * written out in full because Tailwind scans source for literals and would
 * not find one that was assembled at runtime.
 */
function aspectClass(pageSize: Settings["pageSize"]): string {
  return pageSize === "LETTER" ? "aspect-[1/1.294]" : "aspect-[1/1.414]";
}

/** Cards fetched on arrival rather than when scrolled near: one row on a wide screen. */
const EAGER_CARDS = 3;

export function TemplateThumbnail({
  template,
  position,
  className,
}: {
  template: TemplateDefinition;
  /**
   * The card's place in the whole gallery, from 0. The first row is fetched
   * at once and the very first at high priority — on a wide screen it is the
   * page's largest paint. Everything after waits until it is scrolled near.
   */
  position: number;
  className?: string;
}) {
  const aspect = aspectClass(template.settings.pageSize);
  const image = templateImage(template.id);

  if (!image) {
    // Only reachable with a template added and `pnpm thumbnails:build` not
    // run, which `template-images.test.ts` fails on. The card still carries
    // its name and description, which is what decides the choice.
    return <Skeleton className={className ?? `${aspect} w-full rounded-md`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- a committed, pre-sized WebP; the image optimizer would re-encode a file that is already the right size
    <img
      src={image.src}
      width={image.width}
      height={image.height}
      alt={`The ${template.name} template, rendered as a resume page`}
      className={className ?? `${aspect} h-auto w-full rounded-md object-cover object-top`}
      loading={position < EAGER_CARDS ? "eager" : "lazy"}
      fetchPriority={position === 0 ? "high" : "auto"}
      decoding="async"
    />
  );
}
