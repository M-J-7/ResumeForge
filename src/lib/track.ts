/**
 * Sends one event name to this site's own counter, and nothing else.
 *
 * See `src/lib/events.ts` for what a name can be. What a request carries is
 * fixed here, in one place, so no call site can add to it:
 *
 * - **The name, alone.** `{"e":"export:pdf"}`. No properties, no identifier,
 *   no timestamp, no URL beyond a public path inside a view's name.
 * - **No cookie.** `credentials: "omit"`, so a signed-in visitor's session
 *   never travels with an event and the server could not tie one to an
 *   account if it tried — and the server refuses any event that arrives with
 *   a cookie, so that stays true however this is called.
 * - **Same origin only.** `connect-src 'self'` in the CSP already makes
 *   anything else impossible; this is not a way around it.
 *
 * Nothing is sent when the browser says the visitor has asked not to be
 * counted — Global Privacy Control or Do Not Track. Neither obliges a
 * cookieless first-party count to stop, and that is the point of honouring
 * them: somebody who switched one on meant it.
 *
 * Fire and forget. A count that fails to send is a count that did not
 * happen, never an error a visitor sees, and `keepalive` lets the one sent
 * from a download or a link click outlive the page it was sent from.
 */

import type { EventName } from "@/lib/events";

export const EVENTS_ENDPOINT = "/api/e";

/** True when the visitor has asked, through the browser, not to be counted. */
export function declinedCounting(nav: Navigator | undefined = globalThis.navigator): boolean {
  if (!nav) return true;
  const gpc = (nav as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  return gpc === true || nav.doNotTrack === "1";
}

export function track(name: EventName): void {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  if (declinedCounting()) return;
  try {
    void fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ e: name }),
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A browser that cannot even build the request is not counted.
  }
}
