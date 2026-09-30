/**
 * `POST /api/e` — the first-party usage counter (MONETISATION.md Phase 1).
 *
 * Takes one allowlisted event name and adds one to today's count for it, in
 * memory; `src/server/events.ts` writes the counts in batches. What it will
 * accept, and why each rule is there, is `src/server/event-request.ts`. What
 * a page can send is `src/lib/track.ts`, and what a name can be is
 * `src/lib/events.ts`.
 *
 * It reads no session and sets no cookie. The reply is an empty `204` for
 * anything it counted or chose not to count, so a caller cannot tell which.
 */

import { judgeEventRequest } from "@/server/event-request";
import { eventCounter } from "@/server/events";
import { siteOrigin } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const verdict = await judgeEventRequest(request, siteOrigin());
  if (verdict.count) eventCounter.record(verdict.count);
  return new Response(null, { status: verdict.status, headers: noStore });
}
