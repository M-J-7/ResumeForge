/**
 * Whether a request to `POST /api/e` is counted, and what the reply is.
 *
 * Every rule here narrows what the endpoint can be made to do, and each one
 * is cheap enough to run before anything is parsed:
 *
 * 1. **From this site's own pages.** A browser always sends `Origin` on a
 *    POST; a request from any other origin is refused. Together with the
 *    JSON content type — which no form and no `sendBeacon` can send across
 *    origins without a preflight this server never answers — that stops a
 *    third-party page from spending its visitors' browsers on our counts.
 * 2. **Without a cookie.** The page sends events with `credentials: "omit"`
 *    (`src/lib/track.ts`), so a cookie means the request did not come from
 *    it. Refusing those keeps a promise the privacy page makes: an event is
 *    never received alongside a session, so none could be tied to an account.
 * 3. **Small.** The body is `{"e":"<name>"}` and nothing else; anything over
 *    a few hundred bytes is refused before it is read.
 * 4. **A name on the list**, and a view of a page that exists.
 * 5. **Not a crawler.** Bots and audit tools are answered normally and not
 *    counted — the numbers are for people. The user agent is looked at here
 *    and nowhere else, and it is never stored.
 *
 * The reply to an accepted event, a crawler, or a full window is the same
 * `204`, so a caller learns nothing about which it was.
 */

import { isEventName, MAX_EVENT_NAME_LENGTH } from "@/lib/events";
import { isCountedView } from "@/server/event-paths";

/** `{"e":"…"}` with the longest name, and room to spare. */
export const MAX_BODY_BYTES = MAX_EVENT_NAME_LENGTH + 64;

/**
 * User agents whose visits are not a person's. Deliberately broad — a real
 * visitor wrongly left out costs one count, and a crawler wrongly counted
 * misleads every figure that includes it.
 */
export const NOT_A_PERSON =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pagespeed|headlesschrome|phantomjs|curl|wget|python-requests|go-http-client|uptimerobot/i;

export interface EventVerdict {
  status: 204 | 400 | 403 | 413 | 415;
  /** The name to count, when there is one to count. */
  count?: string;
}

export async function judgeEventRequest(request: Request, origin: string): Promise<EventVerdict> {
  const headers = request.headers;

  if (headers.get("origin") !== origin) return { status: 403 };
  if (headers.has("cookie")) return { status: 400 };
  if (!headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { status: 415 };
  }
  const declared = Number(headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { status: 413 };

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { status: 413 };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { status: 400 };
  }
  // Exactly one key. An object with anything else in it is not from our page,
  // and the second key is where a property would try to ride along.
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { status: 400 };
  const keys = Object.keys(body);
  const name = (body as { e?: unknown }).e;
  if (keys.length !== 1 || typeof name !== "string" || !isEventName(name)) {
    return { status: 400 };
  }
  if (name.startsWith("view:") && !isCountedView(name)) return { status: 400 };

  if (NOT_A_PERSON.test(headers.get("user-agent") ?? "")) return { status: 204 };
  return { status: 204, count: name };
}
