/**
 * The document a template's picture is a picture of.
 *
 * The committed sample resume (`src/lib/resume/sample.ts`) with the
 * template's settings applied and its sections in the template's order —
 * exactly what `applyTemplate` does to a real draft, so the gallery shows
 * the document a visitor gets rather than a close cousin of it.
 *
 * Used by `template-images.test.ts`, which renders each one through the real
 * emitter to pin and regenerate the gallery's images. Nothing on a page
 * imports this: the images are files.
 */

import { SAMPLE_RESUME } from "@/lib/resume/sample";
import type { ResumeDocument } from "@/lib/resume/schema";
import type { TemplateDefinition } from "@/lib/resume/templates";

export function templateSample(template: TemplateDefinition): ResumeDocument {
  return {
    ...SAMPLE_RESUME,
    settings: template.settings,
    sections: orderSections(SAMPLE_RESUME, template),
  };
}

/** The template's order, with anything it does not name kept after it. */
function orderSections(sample: ResumeDocument, template: TemplateDefinition) {
  const rank = new Map(template.sectionOrder.map((type, index) => [type, index]));
  return [...sample.sections].sort(
    (a, b) =>
      (rank.get(a.type) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.type) ?? Number.MAX_SAFE_INTEGER),
  );
}
