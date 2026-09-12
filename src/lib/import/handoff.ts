/**
 * Handing a parsed resume from `/check` to `/builder` (P31-A4).
 *
 * One key, in one module, because the two ends of a handoff that agree on a
 * string by coincidence stop agreeing the first time either is edited.
 *
 * ## Why `sessionStorage` and not a query string, a cookie or the server
 *
 * The whole promise of `/check` is that the file never leaves the tab. A
 * resume in a URL lands in browser history, in the `Referer` header the next
 * navigation sends, and in the access log of a server that is supposed to
 * have received nothing at all. A cookie is worse — it is attached to every
 * subsequent request by definition. `sessionStorage` is scoped to the tab,
 * cleared when it closes, and never transmitted.
 *
 * It is read once and removed, so a refresh of `/builder` does not silently
 * re-import over whatever the user has done since.
 */

export const CHECK_HANDOFF_KEY = "ats-resume-builder:check-handoff";

/** Reads and clears the handoff. Returns null when there is none. */
export function takeCheckHandoff(): unknown | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHECK_HANDOFF_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(CHECK_HANDOFF_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
