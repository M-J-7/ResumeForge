"use client";

/**
 * The template gallery (P32-B3).
 *
 * A card per template, each a real render of the sample resume under that
 * template's settings — see `TemplateThumbnail.tsx` for why they are real
 * renders and why they are files rather than rendered here.
 *
 * ## Grouped, because twenty-four cards is a wall
 *
 * At twelve, one grid was a gallery. At twenty-four it is a scroll — and the
 * question a visitor is actually holding, "is one of these for my country or
 * my field, or is none of them?", cannot be answered from a thumbnail, which
 * differs only in typography. `TEMPLATE_GROUPS` answers it in prose above
 * each grid.
 *
 * The split is a `groups` prop rather than a second component so the cards
 * keep one numbering across the groups: the first row of the whole gallery
 * is fetched on arrival, whichever group it sits in.
 *
 * ## What each card says, and what it refuses to
 *
 * A name, a picture, and one line about who the template suits. No badges,
 * no "most popular", no "recruiter favourite". D14 rules out outcome claims
 * and `templates.test.ts` asserts their absence; beyond that, ranking
 * typographic choices by imagined effectiveness would be inventing
 * information we do not have. `forWho` says who it suits and why, which is a
 * claim about the reader's situation rather than about their results.
 *
 * The group blurbs are held to the same line. "Where you are applying"
 * describes a paper size and a length convention — both checkable facts. It
 * does not claim a template performs better in that market, because nobody
 * can substantiate that.
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
import { TEMPLATES, TEMPLATE_GROUPS, type TemplateDefinition } from "@/lib/resume/templates";
import { cn } from "@/lib/utils";
import { TemplateThumbnail } from "./TemplateThumbnail";

interface TemplateGalleryProps {
  /** The template the open document currently matches, if any. */
  selectedId?: string | null;
  /** Runs on activation. With `href` set it runs *before* the navigation. */
  onSelect: (template: TemplateDefinition) => void;
  /** Renders each card as a link to this route instead of as a button. */
  href?: string;
  actionLabel?: string;
  className?: string;
  /**
   * Split the cards under the three group headings, sized for the surface.
   * Left off, they are one flat grid.
   */
  groups?: "page" | "panel";
}

export function TemplateGallery({ groups, ...card }: TemplateGalleryProps) {
  if (!groups) {
    return <TemplateGrid {...card} templates={TEMPLATES} label="Resume templates" />;
  }

  const onPage = groups === "page";

  return (
    <div className={cn("flex flex-col", onPage ? "gap-12" : "gap-6")}>
      {TEMPLATE_GROUPS.map((group) => (
        <section key={group.id} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {/*
              `h2` on the page, `h4` in the Design dialog — where the section
              above these already spends the `h3`. A gallery that hard-coded
              one level would skip a heading on whichever surface it was not
              written for, and the outline a screen-reader user navigates by
              is the entire reason these are headings and not styled
              paragraphs.
            */}
            {onPage ? (
              <h2 className="text-text text-display-3 font-semibold">{group.title}</h2>
            ) : (
              <h4 className="text-text text-sm font-semibold">{group.title}</h4>
            )}
            <p
              className={cn(
                "text-muted max-w-read leading-relaxed",
                onPage ? "text-body" : "text-xs",
              )}
            >
              {group.blurb}
            </p>
          </div>
          <TemplateGrid
            {...card}
            templates={TEMPLATES.filter((template) => template.group === group.id)}
            label={group.title}
          />
        </section>
      ))}
    </div>
  );
}

function TemplateGrid({
  selectedId,
  onSelect,
  href,
  actionLabel = "Use this template",
  className,
  templates,
  label,
}: Omit<TemplateGalleryProps, "groups"> & {
  templates: readonly TemplateDefinition[];
  /** Names the list, so it is a group rather than an anonymous grid. */
  label: string;
}) {
  return (
    <ul
      // Named, so a test can scope to it rather than counting every link on
      // the page — and so the grouped form reads as three lists to a screen
      // reader instead of one undifferentiated run of controls.
      aria-label={label}
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {templates.map((template) => {
        const selected = selectedId === template.id;
        return (
          <li key={template.id}>
            {/*
              The whole card is one target rather than a card containing a
              button: that is what a pointer expects, and it halves the tab
              stops in a gallery this size. `aria-pressed`
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
                <TemplateThumbnail template={template} position={TEMPLATES.indexOf(template)} />
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
