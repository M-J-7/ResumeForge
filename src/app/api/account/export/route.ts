/**
 * The whole-account data export (M2-T6).
 *
 * A route handler rather than a Server Action, because the point is to hand
 * the browser a *file*: a real response with `Content-Disposition` downloads
 * without any client-side blob juggling, and the link works from a plain
 * anchor with no JavaScript involved.
 *
 * Every resume is exported as a standalone JSON Resume document, wrapped in
 * a thin envelope because the format describes exactly one resume and an
 * account holds several. Each entry can be lifted out and used on its own.
 *
 * This is the GDPR data export, and it is not a diminished version of one:
 * it carries the full content of every resume, not a summary of it.
 */

import { getSessionUser } from "@/server/auth/session";
import { listResumes, loadResume } from "@/server/resumes";
import { consume, retryAfterMessage } from "@/server/rate-limit";
import { toJsonResume, type AccountExport } from "@/lib/interop/json-resume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generous for a person, bounded for a script.
 *
 * This reads and serializes every resume on the account, and `better-sqlite3`
 * is synchronous — a tight loop over it stalls the event loop for every other
 * user, not just the caller. Nobody legitimately exports their data twelve
 * times in an hour.
 */
const EXPORT_LIMIT = { limit: 12, windowMs: 60 * 60 * 1000 };

export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in.", { status: 401 });

  const allowance = await consume(`export:${user.id}`, EXPORT_LIMIT);
  if (!allowance.allowed) {
    return new Response(
      `Too many exports. Try again ${retryAfterMessage(allowance.retryAfterMs)}.`,
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(allowance.retryAfterMs / 1000)),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const summaries = await listResumes(user.id);

  const resumes: AccountExport["resumes"] = [];
  for (const summary of summaries) {
    // Loaded one at a time and by owner: `loadResume` puts the user id in the
    // `where` clause, so this cannot reach a row the listing did not already
    // prove belongs to them.
    const loaded = await loadResume(user.id, summary.id);
    if (!loaded) continue;
    resumes.push({
      id: summary.id,
      title: summary.title,
      updatedAt: summary.updatedAt.toISOString(),
      resume: toJsonResume(loaded.document),
    });
  }

  const payload: AccountExport = {
    format: "ats-resume-builder/account-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    resumes,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="resumes-${date}.json"`,
      // An export of someone's personal data has no business in a cache.
      "Cache-Control": "no-store",
    },
  });
}
