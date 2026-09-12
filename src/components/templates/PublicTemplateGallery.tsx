"use client";

/**
 * The gallery on the public `/templates` page (P32-B3).
 *
 * Same `TemplateGallery` the Design dialog uses, so the twelve documents a
 * visitor compares are the twelve they get. What differs is what a click
 * means: here there is no open document to restyle, so choosing one records
 * the id and sends the visitor to the builder, which applies it on arrival.
 *
 * The handoff is `sessionStorage` for the same reason `/check`'s is
 * (`lib/import/handoff.ts`): tab-scoped, never transmitted, read once. A
 * template id is not sensitive the way a resume is, but two mechanisms for
 * one job is how they drift, and a query parameter would need the builder to
 * distinguish "seed a new document" from "the user pasted a URL" forever
 * after.
 */

import { SpotlightGroup } from "@/components/ui/Spotlight";
import { TemplateGallery } from "./TemplateGallery";
import { TEMPLATE_HANDOFF_KEY } from "@/lib/resume/template-handoff";

export function PublicTemplateGallery() {
  return (
    /*
      One light across all twelve, on the public page only. In the Design
      dialog the gallery is a chooser inside a modal and each card lights on
      its own hover, which is the right affordance there; here it is a display
      case, and a single source moving across it is what makes twelve cards
      read as one surface.
    */
    <SpotlightGroup>
      <TemplateGallery
        href="/builder"
        actionLabel="Start with this"
        onSelect={(template) => {
          try {
            sessionStorage.setItem(TEMPLATE_HANDOFF_KEY, template.id);
          } catch {
            // Storage disabled. The builder still opens; it just opens on the
            // default template, which is a working resume either way.
          }
        }}
      />
    </SpotlightGroup>
  );
}
