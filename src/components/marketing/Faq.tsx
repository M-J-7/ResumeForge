/**
 * The questions, as disclosure widgets that work with scripting off.
 *
 * `<details>`/`<summary>` rather than a React accordion, and that is the whole
 * design decision. This is a section whose entire job is to be *read by
 * strangers arriving from a search*, so it has to be in the HTML, openable
 * without a bundle, and announced correctly by a screen reader without any
 * ARIA written by hand. The browser does all four; a `useState` accordion does
 * none of them and adds a client component to the page for a `hidden`
 * attribute.
 *
 * Each question is an `<h3>` inside its `<summary>`. That is valid — the
 * summary's content model admits one heading element — and it is what puts the
 * questions in the document outline, which is what a "People also ask" result
 * is built out of. The matching `FAQPage` markup comes from the same array, so
 * the two cannot describe different pages.
 *
 * The marker is a plus rotated to a cross by `group-open`. A rotation rather
 * than a swapped glyph, so there is one element to animate and nothing to
 * flash; `aria-hidden`, because `<summary>` already announces its own state.
 */

import { BuiltListItem } from "./Build";
import { PlusIcon } from "@/components/ui/icons";
import type { FaqItem } from "@/lib/faq";

export function Faq({ items }: { items: readonly FaqItem[] }) {
  return (
    <ul className="border-line mt-10 border-t">
      {items.map((item) => (
        <BuiltListItem key={item.question} variant="row" className="border-line border-b">
          <details className="group">
            <summary className="focus-visible:ring-accent flex cursor-pointer list-none items-start justify-between gap-6 rounded-sm py-5 focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <h3 className="text-text text-title font-semibold">{item.question}</h3>
              <PlusIcon
                aria-hidden
                className="text-accent mt-1 h-4 w-4 shrink-0 transition-transform duration-[var(--dur)] ease-[var(--ease)] group-open:rotate-45"
              />
            </summary>
            <p className="text-muted text-body max-w-read pb-6 leading-relaxed">{item.answer}</p>
          </details>
        </BuiltListItem>
      ))}
    </ul>
  );
}
