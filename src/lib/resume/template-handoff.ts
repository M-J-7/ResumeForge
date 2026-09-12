/**
 * Carrying a template choice from `/templates` to `/builder` (P32-B3).
 *
 * The same mechanism as `lib/import/handoff.ts`, and deliberately so: one
 * pattern for "the previous page picked something, this page should act on
 * it", rather than a second one that behaves subtly differently.
 *
 * A template id is not sensitive the way a resume is, so the privacy
 * argument that forced `sessionStorage` there does not apply here. What does
 * apply is the other half of it: read once and cleared, so a refresh of the
 * builder does not silently restyle a document the user has since changed
 * by hand. A query parameter would make that impossible — `?template=atlas`
 * survives every reload and every shared link, and the builder would have no
 * way to tell "just chose this" from "opened an old bookmark".
 */

export const TEMPLATE_HANDOFF_KEY = "ats-resume-builder:template-handoff";

/** Reads and clears the pending template id. Null when there is none. */
export function takeTemplateHandoff(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const id = sessionStorage.getItem(TEMPLATE_HANDOFF_KEY);
    if (id === null) return null;
    sessionStorage.removeItem(TEMPLATE_HANDOFF_KEY);
    return id;
  } catch {
    return null;
  }
}
