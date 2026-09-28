/**
 * The header for the prerendered content pages: the same bar as `AppHeader`,
 * with the identity supplied by the browser instead of the server.
 *
 * These pages — the landing page, `/check`, `/templates`, `/pricing`, the
 * examples, the guides, `/privacy`, `/terms` — are built once and served as
 * files. On a 1/8-OCPU instance that is the difference between surviving a
 * link being shared and not: a file costs nothing to serve, and a page
 * rendered per request costs a CPU the instance does not have. Reading the
 * session here would make every one of them per-request again, which is what
 * `AppHeader` used to do from the root layout for the whole site.
 *
 * Mounted by `src/app/(site)/layout.tsx`, and by `not-found.tsx` and
 * `error.tsx`, which render above the route groups and so above either
 * group's header. See `./client-session.ts` for the rule that keeps the
 * browser-side identity from ever purging somebody's own work.
 */

import { HeaderChrome } from "./HeaderChrome";
import { ClientStorageOwner, SessionHeaderAccount, SessionHeaderNav } from "./SessionIslands";

export function SiteHeader() {
  return (
    <HeaderChrome
      before={<ClientStorageOwner />}
      nav={<SessionHeaderNav />}
      account={<SessionHeaderAccount />}
    />
  );
}
