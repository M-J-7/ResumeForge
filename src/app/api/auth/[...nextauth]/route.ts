/**
 * Auth.js's own endpoints (M2-T2): sign-in, callback, session, sign-out, CSRF.
 *
 * `runtime = "nodejs"` is stated rather than assumed. The adapter reaches
 * SQLite through `better-sqlite3`, a native module that cannot load on the
 * edge runtime, and the failure if this ever flipped would appear as a
 * module-resolution error inside a vendor package rather than as anything
 * pointing back here.
 */

import { handlers } from "@/server/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
