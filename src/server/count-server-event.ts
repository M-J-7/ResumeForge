/**
 * Counts something the server itself saw happen.
 *
 * A sign-in link is requested through a Server Action that works without
 * JavaScript, and a sign-in completes on Auth.js's callback route — neither
 * has a page to call `track` from, and both are the conversions the counter
 * exists for. So they are counted here, with the same refusals the browser
 * applies: a visitor whose browser sends `Sec-GPC: 1` or `DNT: 1` is not
 * counted, and neither is a crawler. Only the event's name is recorded —
 * never the address, the account or anything else the request carries.
 */

import { headers } from "next/headers";
import type { ActionEvent } from "@/lib/events";
import { NOT_A_PERSON } from "@/server/event-request";
import { eventCounter } from "@/server/events";

export async function countServerEvent(name: ActionEvent): Promise<void> {
  try {
    const incoming = await headers();
    if (incoming.get("sec-gpc") === "1" || incoming.get("dnt") === "1") return;
    if (NOT_A_PERSON.test(incoming.get("user-agent") ?? "")) return;
  } catch {
    // Outside a request there is nobody to ask, and nothing to count either.
    return;
  }
  eventCounter.record(name);
}
