/**
 * Liveness and readiness in one endpoint.
 *
 * The Docker healthcheck used to fetch `/`, which proves React rendered — and
 * a container serving a perfect landing page over a database it cannot open
 * is exactly the state a healthcheck exists to catch. This touches the
 * database, so an unhealthy container is restarted or pulled from rotation
 * instead of quietly failing every signed-in request.
 *
 * The query is `SELECT 1`, not a count: `better-sqlite3` is synchronous, and
 * a healthcheck that scans a table blocks the event loop for every user on a
 * schedule.
 *
 * Deliberately says almost nothing. Version numbers, row counts, and
 * migration names on an unauthenticated endpoint are reconnaissance; the
 * operator can read the logs.
 */

import { getPrisma } from "@/server/db";
import { logError } from "@/server/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const prisma = await getPrisma();
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch (error) {
    // The message goes to the server log, never to the response — a
    // connection string in a health response is a credential leak, and
    // `logError` strips it from the log as well.
    logError("health", error);
    return Response.json({ status: "unhealthy" }, { status: 503, headers: noStore });
  }

  return Response.json({ status: "ok" }, { headers: noStore });
}

const noStore = { "Cache-Control": "no-store" };
