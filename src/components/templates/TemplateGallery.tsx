"use client";

/**
 * The template gallery (P32-B3).
 *
 * Twelve cards, each a real render of the sample resume under that
 * template's settings — see `TemplateThumbnail.tsx` for why they are real
 * renders and why they arrive one at a time.
 *
 * ## What each card says, and what it refuses to
 *
 * A name, a picture, and one line about who the template suits. No badges,
 * no "most popular", no "recruiter favourite". D14 rules out outcome claims
 * and `templates.test.ts` asserts their absence; beyond that, ranking twelve
 * typographic choices by imagined effectiveness would be inventing
 * information we do not have. `forWho` says who it suits and why, which is a
 * claim about the reader's situation rather than about their results.
 *
 * ## Used on two surfaces
 *
 * `/templates` (public, indexable) and the builder's Design dialog. The
 * renders, the cache and the copy are shared, so the gallery a visitor
 * compares in is the gallery they end up using.
 *
 * What differs is what a card *is*. In the builder it applies a template to
 * the open document, so it is a `<button>`. On the public page it takes the
 * visitor to the builder, so it is an `<a href>` — right-clickable,
 * middle-clickable, and visible to a crawler, none of which a button with a
 * navigation handler is. That is landmine 9 restated as a rule about
 * elements rather than about `useRouter`.
 */

import { Badge } from "@/components/ui/badge";
import { CheckIcon } from "@/components/ui/icons";
import { SAMPLE_RESUME } from "@/lib/resume/sample";
import { TEMPLATES, type TemplateDefinition } from "@/lib/resume/templates";
import { cn } from "@/lib/utils";
import { TemplateThumbnail, useTemplateThumbnails } from "./TemplateThumbnail";

export function TemplateGallery({
  selectedId,
  onSelect,
  href,
  actionLabel = "Use this template",
  className,
}: {
  /** The template the open document currently matches, if any. */
  selectedId?: string | null;
  /** Runs on activation. With `href` set it runs *before* the navigation. */
  onSelect: (template: TemplateDefinition) => void;
  /** Renders each card as a link to this route instead of as a button. */
  href?: string;
  actionLabel?: string;
  className?: string;
}) {
  const thumbnails = useTemplateThumbnails(TEMPLATES, SAMPLE_RESUME);

  return (
    <ul
      // Named, so it is one identifiable list rather than an anonymous grid
      // of twelve controls — and so a test can scope to it rather than
      // counting every link on the page.
      aria-label="Resume templates"
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {TEMPLATES.map((template) => {
        const selected = selectedId === template.id;
        return (
          <li key={template.id}>
            {/*
              The whole card is one target rather than a card containing a
              button: that is what a pointer expects, and it keeps the tab
              order to twelve stops instead of twenty-four. `aria-pressed`
              carries the selected state on the button form, so it is never
              conveyed by the focus ring alone.
            */}
            <CardShell
              href={href}
              selected={selected}
              onActivate={() => onSelect(template)}
              label={`${template.name} — ${template.forWho}`}
            >
              <div className="bg-surface-2 border-line overflow-hidden rounded-md border">
                <TemplateThumbnail template={template} src={thumbnails[template.id]} />
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text text-sm font-semibold">{template.name}</span>
                  {selected ? (
                    <Badge tone="accent">
                      <CheckIcon className="h-3 w-3" />
                      In use
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted text-xs leading-relaxed">{template.forWho}</p>
                <span className="text-accent mt-auto pt-1 text-xs font-medium">
                  {selected ? "Applied" : actionLabel}
                </span>
              </div>
            </CardShell>
          </li>
        );
      })}
    </ul>
  );
}

const CARD_CLASS = cn(
  "border-line bg-surface-0 spot lift flex h-full w-full flex-col gap-3 rounded-lg border p-3 text-left",
  "focus-visible:ring-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
);

function CardShell({
  href,
  selected,
  onActivate,
  label,
  children,
}: {
  href?: string;
  selected: boolean;
  onActivate: () => void;
  /** Names the whole card, so a screen reader gets one sensible target. */
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(
    CARD_CLASS,
    // `.lift` supplies the shadow and the settle; this is only the border and
    // ground. A selected card is already raised by its ring and must not read
    // as hovered when it is not.
    selected ? "border-accent ring-accent ring-1" : "hover:border-line-strong",
  );

  /*
   * `aria-label` on **both** forms, not just the link.
   *
   * Without it the button's accessible name is its concatenated content —
   * which begins with the thumbnail's alt text, so the card announces as
   * "The Atlas template, rendered as a resume page Atlas In use The default,
   * and the one to keep…". Worse, the name *changes* as the thumbnail
   * arrives: before the render it is "Atlas Use this template" and after it
   * is not. A control whose accessible name depends on whether an image has
   * finished loading is a bug for a screen-reader user before it is a
   * flaky selector, and it was found as the latter.
   */
  if (href) {
    return (
      <a href={href} onClick={onActivate} aria-label={label} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-pressed={selected}
      aria-label={label}
      className={className}
    >
      {children}
    </button>
  );
}
